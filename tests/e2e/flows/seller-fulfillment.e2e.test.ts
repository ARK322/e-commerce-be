import '../helpers/mocks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { Order } from '@/infrastructure/mongo';
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

describeE2E('seller order fulfillment (E2E)', () => {
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

  it('checkout → paid → shipped → delivered', async () => {
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
      externalId: 'e2e-fulfillment-payment',
      orderId,
      paidAmount: orderBody.order.totalAmount,
      itemTransactions: [{ itemId: productId, paymentTransactionId: 'txn-fulfillment-1' }],
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
      payload: 'token=e2e-fulfillment-token',
    });

    const shipmentResponse = await app.inject({
      method: 'POST',
      url: `/orders/${orderId}/shipments`,
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: {
        trackingNumber: 'TRK-E2E-001',
        carrier: 'yurtici',
      },
    });

    expect(shipmentResponse.statusCode).toBe(201);

    const shippedResponse = await app.inject({
      method: 'PATCH',
      url: `/orders/${orderId}/items/${productId}/status`,
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: { status: 'shipped' },
    });

    expect(shippedResponse.statusCode).toBe(200);

    const deliveredResponse = await app.inject({
      method: 'PATCH',
      url: `/orders/${orderId}/items/${productId}/status`,
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: { status: 'delivered' },
    });

    expect(deliveredResponse.statusCode).toBe(200);

    const paidOrder = await Order.findById(orderId).lean();
    expect(paidOrder?.status).toBe('delivered');
    expect(paidOrder?.items[0]?.fulfillmentStatus).toBe('delivered');

    const buyerOrderResponse = await app.inject({
      method: 'GET',
      url: `/orders/${orderId}`,
      headers: { authorization: `Bearer ${buyerToken}` },
    });

    expect(buyerOrderResponse.statusCode).toBe(200);
    const buyerOrderBody = buyerOrderResponse.json() as {
      order: { shipments: Array<{ trackingNumber: string }> };
    };
    expect(buyerOrderBody.order.shipments[0]?.trackingNumber).toBe('TRK-E2E-001');
  });
});
