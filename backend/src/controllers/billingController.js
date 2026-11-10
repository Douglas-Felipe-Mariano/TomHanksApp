const Stripe = require('stripe');
const pool = require('../config/database');
const logger = require('../utils/logger');

const FREE_FAVORITE_LIMIT = 5;

const getStripeClient = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || !secretKey.startsWith('sk_test_')) {
    throw new Error('Configure uma STRIPE_SECRET_KEY de teste (sk_test_).');
  }

  return new Stripe(secretKey, { maxNetworkRetries: 2 });
};

const resolvePaidCheckout = (session) => {
  if (session?.mode !== 'payment' || session.payment_status !== 'paid') {
    return null;
  }

  const userId = Number(session.client_reference_id || session.metadata?.userId);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    return null;
  }

  const customerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id || null;

  return { userId, customerId };
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
      const entitlement = resolvePaidCheckout(event.data?.object);
      if (entitlement) {
        const [result] = await connection.execute(
          `UPDATE usuarios
           SET premium = 1,
               stripe_customer_id = COALESCE(?, stripe_customer_id),
               premium_since = COALESCE(premium_since, CURRENT_TIMESTAMP)
           WHERE id = ?`,
          [entitlement.customerId, entitlement.userId]
        );

        if (result.affectedRows > 0) {
          activatedUserId = entitlement.userId;
        }
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
  const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
  if (!priceId || !priceId.startsWith('price_')) {
    return res.status(503).json({ error: 'Plano Premium ainda não configurado no Stripe.' });
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
      return res.status(409).json({ error: 'Sua conta já possui o Plano Premium.' });
    }

    const stripe = getStripeClient();
    const appUrl = (process.env.APP_PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '');
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: process.env.STRIPE_SUCCESS_URL || `${appUrl}/?checkout=success`,
      cancel_url: process.env.STRIPE_CANCEL_URL || `${appUrl}/?checkout=cancelled`,
      client_reference_id: String(users[0].id),
      customer: users[0].stripe_customer_id || undefined,
      customer_email: users[0].stripe_customer_id ? undefined : users[0].email,
      metadata: { userId: String(users[0].id) },
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
      'SELECT premium FROM usuarios WHERE id = ?',
      [req.userId]
    );
    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const premium = Boolean(Number(users[0].premium));
    return res.json({
      premium,
      favoriteLimit: premium ? null : FREE_FAVORITE_LIMIT,
    });
  } catch (error) {
    console.error('Erro ao consultar Plano Premium:', error.message);
    return res.status(500).json({ error: 'Não foi possível consultar o Plano Premium.' });
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

exports.resolvePaidCheckout = resolvePaidCheckout;
exports.processStripeEvent = processStripeEvent;