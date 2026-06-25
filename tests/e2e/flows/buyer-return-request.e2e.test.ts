import '../helpers/mocks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
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

describeE2E('buyer return request (E2E)', () => {
  let app: FastifyInstance;
  let productId = '';
  let sellerToken = '';

  beforeAll(async () => {
    ({ app } = await createE2EContext());
    const catalog = await seedApprovedSellerCatalog();
    productId = catalog.productId;

    const sellerEmail = `seller-fixture-${catalog.sellerId.slice(0, 8)}@test.local`;
    sellerToken = await loginUser(app, sellerEmail, 'Test1234!');
  });

  afterAll(async () => {
    await destroyE2EContext(app);
  });

  it('checkout → delivered → iade talebi oluşturur ve listeler', async () => {
    const { email, password, userId } = await registerBuyer(app);
    await verifyUserEmail(app, userId);

    const buyerToken = await loginUser(app, email, password);
    await completeBuyerProfile(app, buyerToken);

    await app.inject({
      method: 'POST',
      url: '/cart/items',
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: { productId, quantity: 1 },
    });

    const orderResponse = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: {},
    });

    expect(orderResponse.statusCode).toBe(201);
    const orderBody = orderResponse.json() as { order: { id: string; totalAmount: number } };
    const orderId = orderBody.order.id;

    mockCompleteIyzicoCheckout.mockResolvedValue({
      status: 'completed',
      externalId: 'e2e-return-payment',
      orderId,
      paidAmount: orderBody.order.totalAmount,
      itemTransactions: [{ itemId: productId, paymentTransactionId: 'txn-return-1' }],
    });

    await app.inject({
      method: 'POST',
      url: '/payments',
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: { orderId },
    });

    await app.inject({
      method: 'POST',
      url: '/payments/callback',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'token=e2e-return-token',
    });

    await app.inject({
      method: 'POST',
      url: `/orders/${orderId}/shipments`,
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: { trackingNumber: 'TRK-RETURN-001', carrier: 'yurtici' },
    });

    await app.inject({
      method: 'PATCH',
      url: `/orders/${orderId}/items/${productId}/status`,
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: { status: 'shipped' },
    });

    await app.inject({
      method: 'PATCH',
      url: `/orders/${orderId}/items/${productId}/status`,
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: { status: 'delivered' },
    });

    const returnResponse = await app.inject({
      method: 'POST',
      url: `/orders/${orderId}/returns`,
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: {
        type: 'return',
        items: [{ productId, quantity: 1, reason: 'Ürün hasarlı' }],
        buyerNote: 'Kutu ezilmiş geldi',
      },
    });

    expect(returnResponse.statusCode).toBe(201);
    const returnBody = returnResponse.json() as {
      returnRequest: { id: string; status: string; type: string };
    };
    expect(returnBody.returnRequest.status).toBe('pending');
    expect(returnBody.returnRequest.type).toBe('return');

    const listResponse = await app.inject({
      method: 'GET',
      url: '/orders/returns',
      headers: { authorization: `Bearer ${buyerToken}` },
    });

    expect(listResponse.statusCode).toBe(200);
    const listBody = listResponse.json() as { returns: Array<{ id: string }> };
    expect(listBody.returns.some((entry) => entry.id === returnBody.returnRequest.id)).toBe(true);
  });
});
