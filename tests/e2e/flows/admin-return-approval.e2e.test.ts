import '../helpers/mocks';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { Payment, ReturnRequest } from '@/infrastructure/mongo';
import { createE2EContext, destroyE2EContext } from '../helpers/setup';
import { isE2EEnabled } from '../helpers/env';
import { mockCompleteIyzicoCheckout, mockRefundIyzicoPayment } from '../helpers/mocks';
import {
  completeBuyerProfile,
  loginUser,
  registerBuyer,
  seedApprovedSellerCatalog,
  seedOwnerAdmin,
  verifyUserEmail,
} from '../helpers/fixtures';

const describeE2E = isE2EEnabled() ? describe : describe.skip;

describeE2E('admin return approval (E2E)', () => {
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

  beforeEach(() => {
    mockRefundIyzicoPayment.mockReset();
    mockRefundIyzicoPayment.mockResolvedValue(true);
  });

  it('alıcı iade talebi açar, admin onaylar ve ödeme iade edilir', async () => {
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
      externalId: 'e2e-approval-payment',
      orderId,
      paidAmount: orderBody.order.totalAmount,
      itemTransactions: [{ itemId: productId, paymentTransactionId: 'txn-approval-1' }],
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
      payload: 'token=e2e-approval-token',
    });

    const returnResponse = await app.inject({
      method: 'POST',
      url: `/orders/${orderId}/returns`,
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: {
        type: 'return',
        items: [{ productId, quantity: 1, reason: 'Tam iade testi' }],
      },
    });

    expect(returnResponse.statusCode).toBe(201);
    const returnId = (returnResponse.json() as { returnRequest: { id: string } }).returnRequest.id;

    const approveResponse = await app.inject({
      method: 'PATCH',
      url: `/auth/admin/returns/${returnId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { decision: 'approved', adminNote: 'Onaylandı' },
    });

    expect(approveResponse.statusCode).toBe(200);
    expect(approveResponse.json()).toMatchObject({
      returnRequest: { status: 'approved' },
    });

    expect(mockRefundIyzicoPayment).toHaveBeenCalled();

    const payment = await Payment.findOne({ orderId }).lean();
    expect(payment?.status).toBe('refunded');

    const returnRecord = await ReturnRequest.findById(returnId).lean();
    expect(returnRecord?.status).toBe('approved');
  });
});
