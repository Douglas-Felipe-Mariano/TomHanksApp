const test = require('node:test');
const assert = require('node:assert/strict');
const { resolvePaidCheckout } = require('../src/controllers/billingController');

test('paid one-time Checkout session resolves its user and Stripe customer', () => {
  const result = resolvePaidCheckout({
    mode: 'payment',
    payment_status: 'paid',
    client_reference_id: '42',
    customer: 'cus_test_123',
  });

  assert.deepEqual(result, { userId: 42, customerId: 'cus_test_123' });
});

test('unpaid, recurring, or malformed Checkout sessions grant no Premium access', () => {
  assert.equal(resolvePaidCheckout({
    mode: 'payment',
    payment_status: 'unpaid',
    client_reference_id: '42',
  }), null);
  assert.equal(resolvePaidCheckout({
    mode: 'subscription',
    payment_status: 'paid',
    client_reference_id: '42',
  }), null);
  assert.equal(resolvePaidCheckout({
    mode: 'payment',
    payment_status: 'paid',
    client_reference_id: 'not-an-id',
  }), null);
});