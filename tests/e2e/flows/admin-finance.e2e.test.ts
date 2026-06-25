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

describeE2E('admin finance (E2E)', () => {
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

  it('ödeme sonrası admin finans özeti ve export çalışır', async () => {
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
      externalId: 'e2e-finance-payment',
      orderId,
      paidAmount: orderBody.order.totalAmount,
      itemTransactions: [{ itemId: productId, paymentTransactionId: 'txn-finance-1' }],
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
      payload: 'token=e2e-finance-token',
    });

    const summaryResponse = await app.inject({
      method: 'GET',
      url: '/auth/admin/finance/summary',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(summaryResponse.statusCode).toBe(200);
    const summary = summaryResponse.json() as { splitCount: number; totalSubtotal: number };
    expect(summary.splitCount).toBeGreaterThanOrEqual(1);
    expect(summary.totalSubtotal).toBeGreaterThan(0);

    const bySellerResponse = await app.inject({
      method: 'GET',
      url: '/auth/admin/finance/by-seller',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(bySellerResponse.statusCode).toBe(200);
    const bySeller = bySellerResponse.json() as { items: unknown[] };
    expect(bySeller.items.length).toBeGreaterThanOrEqual(1);

    const exportResponse = await app.inject({
      method: 'GET',
      url: '/auth/admin/finance/export',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(exportResponse.statusCode).toBe(200);
    expect(exportResponse.headers['content-type']).toContain('text/csv');
    expect(exportResponse.body.length).toBeGreaterThan(0);
  });
});
