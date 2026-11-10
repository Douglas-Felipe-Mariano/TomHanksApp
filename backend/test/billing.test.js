const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveSubscriptionCheckout,
  subscriptionIsEntitled,
  subscriptionHasProPrice,
  monthlyAmountCents,
} = require('../src/controllers/billingController');

test('paid recurring Checkout session resolves user, Stripe customer, and subscription', () => {
  const result = resolveSubscriptionCheckout({
    mode: 'subscription',
    payment_status: 'paid',
    client_reference_id: '42',
    customer: 'cus_test_123',
    subscription: 'sub_test_123',
  });

  assert.deepEqual(result, {
    userId: 42,
    customerId: 'cus_test_123',
    subscriptionId: 'sub_test_123',
  });
});

test('unpaid, one-time, missing subscription, or malformed sessions grant no Premium access', () => {
  assert.equal(resolveSubscriptionCheckout({
    mode: 'subscription',
    payment_status: 'unpaid',
    client_reference_id: '42',
    subscription: 'sub_test_123',
  }), null);
  assert.equal(resolveSubscriptionCheckout({
    mode: 'payment',
    payment_status: 'paid',
    client_reference_id: '42',
  }), null);
  assert.equal(resolveSubscriptionCheckout({
    mode: 'subscription',
    payment_status: 'paid',
    client_reference_id: '42',
  }), null);
  assert.equal(resolveSubscriptionCheckout({
    mode: 'subscription',
    payment_status: 'paid',
    client_reference_id: 'not-an-id',
    subscription: 'sub_test_123',
  }), null);
});

test('only paid active subscription states include Pro', () => {
  assert.equal(subscriptionIsEntitled({ status: 'active' }), true);
  assert.equal(subscriptionIsEntitled({ status: 'trialing' }), true);
  assert.equal(subscriptionIsEntitled({ status: 'past_due' }), false);
  assert.equal(subscriptionIsEntitled({ status: 'canceled' }), false);
  assert.equal(subscriptionIsEntitled({ status: 'unpaid' }), false);
});

test('MRR normalizes recurring Stripe prices to monthly BRL cents', () => {
  assert.equal(monthlyAmountCents({ items: { data: [{ price: { unit_amount: 3990, recurring: { interval: 'month' } } }] } }), 3990);
  assert.equal(monthlyAmountCents({ items: { data: [{ price: { unit_amount: 47880, recurring: { interval: 'year' } } }] } }), 3990);
  assert.equal(monthlyAmountCents({ items: { data: [{ price: { unit_amount: 0, recurring: { interval: 'month' } } }] } }), 0);
});

test('only subscriptions with the configured Pro price can update plan state', () => {
  const previousPriceId = process.env.STRIPE_PRO_PRICE_ID;
  process.env.STRIPE_PRO_PRICE_ID = 'price_pro_test';
  try {
    assert.equal(subscriptionHasProPrice({ items: { data: [{ price: { id: 'price_pro_test' } }] } }), true);
    assert.equal(subscriptionHasProPrice({ items: { data: [{ price: 'price_pro_test' }] } }), true);
    assert.equal(subscriptionHasProPrice({ items: { data: [{ price: { id: 'price_other' } }] } }), false);
  } finally {
    if (previousPriceId === undefined) delete process.env.STRIPE_PRO_PRICE_ID;
    else process.env.STRIPE_PRO_PRICE_ID = previousPriceId;
  }
});