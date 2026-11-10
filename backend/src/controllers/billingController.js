const Stripe = require('stripe');
const pool = require('../config/database');
const logger = require('../utils/logger');

const FREE_APPOINTMENT_LIMIT = 3;

const getStripeClient = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || !secretKey.startsWith('sk_test_')) {
    throw new Error('Configure uma STRIPE_SECRET_KEY de teste (sk_test_).');
  }

  return new Stripe(secretKey, { maxNetworkRetries: 2 });
};

const resolveSubscriptionCheckout = (session) => {
  if (session?.mode !== 'subscription'
      || !['paid', 'no_payment_required'].includes(session.payment_status)) {
    return null;
  }

  const userId = Number(session.client_reference_id || session.metadata?.userId);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    return null;
  }

  const customerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id || null;
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id || null;

  if (!subscriptionId) return null;
  return { userId, customerId, subscriptionId };
};

const subscriptionIsEntitled = (subscription) =>
  ['active', 'trialing'].includes(subscription?.status);

const subscriptionHasProPrice = (subscription) => {
  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  return Boolean(priceId && subscription?.items?.data?.some((item) =>
    (typeof item.price === 'string' ? item.price : item.price?.id) === priceId
  ));
};

const monthlyAmountCents = (subscription) => {
  const price = subscription?.items?.data?.[0]?.price;
  const amount = Number(price?.unit_amount ?? price?.unit_amount_decimal ?? 0);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  if (price?.recurring?.interval === 'year') return Math.round(amount / 12);
  if (price?.recurring?.interval === 'week') return Math.round(amount * 52 / 12);
  if (price?.recurring?.interval === 'day') return Math.round(amount * 365 / 12);
  return amount;
};

const processStripeEvent = async (event) => {
  const connection = await pool.getConnection();
  let activatedUserId = null;

  try {
    await connection.beginTransaction();

    const [existingEvents] = await connection.execute(
      'SELECT event_id FROM stripe_events WHERE event_id = ? FOR UPDATE',
      [event.id]
    );
    if (existingEvents.length > 0) {
      await connection.rollback();
      return { duplicate: true };
    }

    try {
      await connection.execute(
        'INSERT INTO stripe_events (event_id, event_type) VALUES (?, ?)',
        [event.id, event.type]
      );
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        await connection.rollback();
        return { duplicate: true };
      }
      throw error;
    }

    if (event.type === 'checkout.session.completed') {
      const entitlement = resolveSubscriptionCheckout(event.data?.object);
      if (entitlement) {
        const [result] = await connection.execute(
          `UPDATE usuarios
           SET premium = 1,
               stripe_customer_id = COALESCE(?, stripe_customer_id),
               stripe_subscription_id = ?,
               subscription_status = 'active',
               premium_since = COALESCE(premium_since, CURRENT_TIMESTAMP),
               premium_until = NULL
           WHERE id = ? AND (stripe_subscription_id IS NULL OR stripe_subscription_id = ?
             OR subscription_status IN ('inactive', 'canceled', 'past_due'))`,
          [entitlement.customerId, entitlement.subscriptionId, entitlement.userId, entitlement.subscriptionId]
        );

        if (result.affectedRows > 0) {
          activatedUserId = entitlement.userId;
        }
      }
    }

    if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
      const subscription = event.data?.object;
      if (!subscriptionHasProPrice(subscription)) {
        await connection.commit();
        return { duplicate: false, ignored: true };
      }
      const customerId = typeof subscription?.customer === 'string'
        ? subscription.customer
        : subscription?.customer?.id || null;
      const metadataUserId = Number(subscription?.metadata?.userId);
      const userId = Number.isSafeInteger(metadataUserId) && metadataUserId > 0 ? metadataUserId : null;
      const periodEnd = Number(subscription?.current_period_end);
      const premiumUntil = Number.isFinite(periodEnd) && periodEnd > 0
        ? new Date(periodEnd * 1000)
        : null;
      const [result] = await connection.execute(
        `UPDATE usuarios
         SET premium = ?,
           stripe_customer_id = COALESCE(stripe_customer_id, ?),
             stripe_subscription_id = ?,
             subscription_status = ?,
             subscription_amount_cents = ?,
             premium_until = ?,
             premium_since = IF(? = 1, COALESCE(premium_since, CURRENT_TIMESTAMP), premium_since)
         WHERE stripe_subscription_id = ? OR
           (id = ? AND (stripe_subscription_id IS NULL OR subscription_status IN ('inactive', 'canceled', 'past_due')))` ,
        [subscriptionIsEntitled(subscription) ? 1 : 0, customerId, subscription.id, subscription.status || 'inactive',
          monthlyAmountCents(subscription), premiumUntil,
          subscriptionIsEntitled(subscription) ? 1 : 0, subscription.id, userId]
      );
      if (result.affectedRows > 0 && subscriptionIsEntitled(subscription)) {
        activatedUserId = Number(subscription.metadata?.userId) || null;
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data?.object;
      const invoiceSubscription = invoice?.subscription || invoice?.parent?.subscription_details?.subscription;
      const subscriptionId = typeof invoiceSubscription === 'string'
        ? invoiceSubscription : invoiceSubscription?.id;
      if (subscriptionId) {
        await connection.execute(
          `UPDATE usuarios SET premium = 0, subscription_status = 'past_due'
           WHERE stripe_subscription_id = ?`,
          [subscriptionId]
        );
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  if (activatedUserId !== null) {
    logger.logEvent(activatedUserId, 'ativacao_plano_premium');
  }

  return { duplicate: false };
};

exports.createCheckoutSession = async (req, res) => {
  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId || !priceId.startsWith('price_')) {
    return res.status(503).json({ error: 'O preço recorrente Pro ainda não está configurado no Stripe.' });
  }

  try {
    const [users] = await pool.execute(
      'SELECT id, email, premium, stripe_customer_id FROM usuarios WHERE id = ?',
      [req.userId]
    );
    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    if (Boolean(Number(users[0].premium))) {
      return res.status(409).json({ error: 'Sua conta já possui o plano Pro.' });
    }

    const stripe = getStripeClient();
    const configuredPrice = await stripe.prices.retrieve(priceId);
    if (!configuredPrice.active || configuredPrice.currency !== 'brl'
        || configuredPrice.unit_amount !== 3990
        || configuredPrice.recurring?.interval !== 'month'
        || configuredPrice.recurring?.interval_count !== 1) {
      return res.status(503).json({
        error: 'Configure no Stripe Test mode o preço Pro ativo de R$ 39,90 por mês em BRL.',
      });
    }
    const appUrl = (process.env.APP_PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '');
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: process.env.STRIPE_SUCCESS_URL || `${appUrl}/app?checkout=success`,
      cancel_url: process.env.STRIPE_CANCEL_URL || `${appUrl}/app?checkout=cancelled`,
      client_reference_id: String(users[0].id),
      customer: users[0].stripe_customer_id || undefined,
      customer_email: users[0].stripe_customer_id ? undefined : users[0].email,
      metadata: { userId: String(users[0].id), plan: 'pro' },
      subscription_data: { metadata: { userId: String(users[0].id) } },
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error('Erro ao criar checkout do Stripe:', error.message);
    return res.status(503).json({ error: 'Não foi possível iniciar o checkout do Stripe.' });
  }
};

exports.getPremiumStatus = async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT premium, premium_until, subscription_status FROM usuarios WHERE id = ?',
      [req.userId]
    );
    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const premium = Boolean(Number(users[0].premium));
    return res.json({
      premium,
      plan: premium ? 'pro' : 'free',
      subscriptionStatus: users[0].subscription_status,
      premiumUntil: users[0].premium_until,
      appointmentLimit: premium ? null : FREE_APPOINTMENT_LIMIT,
    });
  } catch (error) {
    console.error('Erro ao consultar plano da assinatura:', error.message);
    return res.status(500).json({ error: 'Não foi possível consultar o plano.' });
  }
};

exports.cancelPremiumSubscription = async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT stripe_subscription_id FROM usuarios WHERE id = ?', [req.userId]
    );
    const subscriptionId = users[0]?.stripe_subscription_id;
    if (!subscriptionId) return res.status(404).json({ error: 'Nenhuma assinatura ativa foi encontrada.' });
    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    return res.json({
      message: 'A assinatura será cancelada ao fim do período já pago.',
      cancelAt: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
    });
  } catch (error) {
    console.error('Erro ao agendar cancelamento da assinatura:', error.message);
    return res.status(503).json({ error: 'Não foi possível solicitar o cancelamento agora.' });
  }
};

exports.createPortalSession = async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT stripe_customer_id FROM usuarios WHERE id = ?', [req.userId]
    );
    const customerId = users[0]?.stripe_customer_id;
    if (!customerId) return res.status(404).json({ error: 'Não há cliente Stripe associado a esta conta.' });
    const stripe = getStripeClient();
    const appUrl = (process.env.APP_PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '');
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: process.env.STRIPE_PORTAL_RETURN_URL || `${appUrl}/app?billing=portal`,
    });
    return res.json({ url: session.url });
  } catch (error) {
    console.error('Erro ao criar sessão do portal Stripe:', error.message);
    return res.status(503).json({ error: 'Não foi possível abrir o portal de assinatura.' });
  }
};

exports.getAdminBillingSummary = async (_req, res) => {
  try {
    const [[summary]] = await pool.execute(`
      SELECT COUNT(*) AS users,
        SUM(CASE WHEN premium = 0 THEN 1 ELSE 0 END) AS free_users,
        SUM(CASE WHEN premium = 1 THEN 1 ELSE 0 END) AS pro_users,
        SUM(CASE WHEN premium = 1 AND subscription_status IN ('active', 'trialing') THEN 1 ELSE 0 END) AS active_subscriptions,
        COALESCE(SUM(CASE WHEN premium = 1 AND subscription_status IN ('active', 'trialing')
          THEN subscription_amount_cents ELSE 0 END), 0) AS mrr_cents
      FROM usuarios
    `);
    return res.json({
      users: Number(summary.users || 0),
      freeUsers: Number(summary.free_users || 0),
      proUsers: Number(summary.pro_users || 0),
      activeSubscriptions: Number(summary.active_subscriptions || 0),
      mrrCents: Number(summary.mrr_cents || 0),
      currency: 'brl',
    });
  } catch (error) {
    console.error('Erro ao calcular resumo de cobrança:', error.message);
    return res.status(500).json({ error: 'Não foi possível carregar as métricas de cobrança.' });
  }
};

exports.handleWebhook = async (req, res) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || !Buffer.isBuffer(req.body)) {
    return res.status(503).json({ error: 'Webhook do Stripe ainda não configurado.' });
  }

  let event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      webhookSecret
    );
  } catch (error) {
    console.warn('Assinatura ou payload do webhook Stripe inválido:', error.message);
    return res.status(400).json({ error: 'Webhook inválido.' });
  }

  try {
    const result = await processStripeEvent(event);
    return res.json({ received: true, duplicate: result.duplicate });
  } catch (error) {
    console.error('Erro ao processar webhook do Stripe:', error.message);
    return res.status(500).json({ error: 'Falha ao processar webhook.' });
  }
};

exports.resolveSubscriptionCheckout = resolveSubscriptionCheckout;
exports.subscriptionIsEntitled = subscriptionIsEntitled;
exports.subscriptionHasProPrice = subscriptionHasProPrice;
exports.monthlyAmountCents = monthlyAmountCents;
exports.processStripeEvent = processStripeEvent;