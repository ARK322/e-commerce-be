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
  seedOwnerAdmin,
  verifyUserEmail,
} from '../helpers/fixtures';

const describeE2E = isE2EEnabled() ? describe : describe.skip;

describeE2E('admin returns (E2E)', () => {
  let app: FastifyInstance;
  let adminToken = '';
  let productId = '';

  beforeAll(async () => {
    ({ app } = await createE2EContext());
    const admin = await seedOwnerAdmin();
    adminToken = await loginUser(app, admin.email, admin.password);

    const catalog = await seedApprovedSellerCatalog();
    productId = catalog.productId;
  });

  afterAll(async () => {
    await destroyE2EContext(app);
  });

  it('alıcı iade talebi açar, admin listede görür', async () => {
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

    const orderBody = orderResponse.json() as { order: { id: string; totalAmount: number } };
    const orderId = orderBody.order.id;

    mockCompleteIyzicoCheckout.mockResolvedValue({
      status: 'completed',
      externalId: 'e2e-admin-returns-payment',
      orderId,
      paidAmount: orderBody.order.totalAmount,
      itemTransactions: [{ itemId: productId, paymentTransactionId: 'txn-admin-returns-1' }],
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
      payload: 'token=e2e-admin-returns-token',
    });

    const returnResponse = await app.inject({
      method: 'POST',
      url: `/orders/${orderId}/returns`,
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: {
        type: 'return',
        items: [{ productId, quantity: 1, reason: 'İade testi' }],
      },
    });

    expect(returnResponse.statusCode).toBe(201);
    const returnId = (returnResponse.json() as { returnRequest: { id: string } }).returnRequest.id;

    const listResponse = await app.inject({
      method: 'GET',
      url: '/auth/admin/returns?page=1&limit=20',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(listResponse.statusCode).toBe(200);
    const listBody = listResponse.json() as { items: Array<{ id: string }> };
    expect(listBody.items.some((entry) => entry.id === returnId)).toBe(true);
  });
});
