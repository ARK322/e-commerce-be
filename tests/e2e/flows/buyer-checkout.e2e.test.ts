import '../helpers/mocks';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { Order } from '@/integrations/mongo';
import { createE2EContext, destroyE2EContext } from '../helpers/setup';
import { isE2EEnabled } from '../helpers/env';
import { mockCompleteIyzicoCheckout } from '../helpers/mocks';
import {
  completeBuyerProfile,
  loginUser,
  registerBuyer,
  seedApprovedSellerCatalog,
  verifyUserEmail,
} from '../helpers/fixtures';

const describeE2E = isE2EEnabled() ? describe : describe.skip;

describeE2E('buyer checkout (E2E)', () => {
  let app: FastifyInstance;
  let productId = '';
  let productPrice = 0;

  beforeAll(async () => {
    ({ app } = await createE2EContext());
    const catalog = await seedApprovedSellerCatalog();
    productId = catalog.productId;
    productPrice = catalog.productPrice;
  });

  afterAll(async () => {
    await destroyE2EContext(app);
  });

  beforeEach(() => {
    mockCompleteIyzicoCheckout.mockReset();
  });

  it('register → sepet → sipariş → ödeme → callback → paid', async () => {
    const { email, password, userId } = await registerBuyer(app);
    await verifyUserEmail(app, userId);

    const token = await loginUser(app, email, password);
    await completeBuyerProfile(app, token);

    const cartResponse = await app.inject({
      method: 'POST',
      url: '/cart/items',
      headers: { authorization: `Bearer ${token}` },
      payload: { productId, quantity: 1 },
    });

    expect(cartResponse.statusCode).toBe(200);

    const orderResponse = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(orderResponse.statusCode).toBe(201);

    const orderBody = orderResponse.json() as { order: { id: string; totalAmount: number } };
    const orderId = orderBody.order.id;

    mockCompleteIyzicoCheckout.mockResolvedValue({
      status: 'completed',
      externalId: 'e2e-payment-id',
      orderId,
      paidAmount: orderBody.order.totalAmount,
      itemTransactions: [{ itemId: productId, paymentTransactionId: 'txn-e2e-1' }],
    });

    const paymentResponse = await app.inject({
      method: 'POST',
      url: '/payments',
      headers: { authorization: `Bearer ${token}` },
      payload: { orderId },
    });

    expect(paymentResponse.statusCode).toBe(201);

    const callbackResponse = await app.inject({
      method: 'POST',
      url: '/payments/callback',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'token=e2e-checkout-token',
    });

    expect(callbackResponse.statusCode).toBe(302);
    expect(callbackResponse.headers.location).toContain(`/orders/${orderId}?payment=success`);

    const paidOrder = await Order.findById(orderId).lean();
    expect(paidOrder?.status).toBe('paid');
    expect(paidOrder?.totalAmount).toBeCloseTo(productPrice, 2);
  });

  it('callback iki kez gelince sipariş yine paid kalır', async () => {
    const { email, password, userId } = await registerBuyer(app);
    await verifyUserEmail(app, userId);

    const token = await loginUser(app, email, password);
    await completeBuyerProfile(app, token);

    await app.inject({
      method: 'POST',
      url: '/cart/items',
      headers: { authorization: `Bearer ${token}` },
      payload: { productId, quantity: 1 },
    });

    const orderResponse = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    const orderBody = orderResponse.json() as { order: { id: string; totalAmount: number } };
    const orderId = orderBody.order.id;

    mockCompleteIyzicoCheckout.mockResolvedValue({
      status: 'completed',
      externalId: 'e2e-payment-id-dup',
      orderId,
      paidAmount: orderBody.order.totalAmount,
      itemTransactions: [{ itemId: productId, paymentTransactionId: 'txn-e2e-dup' }],
    });

    await app.inject({
      method: 'POST',
      url: '/payments',
      headers: { authorization: `Bearer ${token}` },
      payload: { orderId },
    });

    const firstCallback = await app.inject({
      method: 'POST',
      url: '/payments/callback',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'token=e2e-checkout-token-dup',
    });

    const secondCallback = await app.inject({
      method: 'POST',
      url: '/payments/callback',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'token=e2e-checkout-token-dup',
    });

    expect(firstCallback.statusCode).toBe(302);
    expect(secondCallback.statusCode).toBe(302);
    expect(firstCallback.headers.location).toContain('payment=success');
    expect(secondCallback.headers.location).toContain('payment=success');

    const paidOrder = await Order.findById(orderId).lean();
    expect(paidOrder?.status).toBe('paid');
  });
});
