import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '@/app/app';

const orderId = '8c9e6679-7425-40de-944b-e07fc1f90ae8';
const buyerId = '550e8400-e29b-41d4-a716-446655440000';
const productId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const checkoutToken = 'checkout-token-idempotent';

const {
  mockCompleteIyzicoCheckout,
  mockFindPaymentByOrderId,
  mockFindOrderByIdLean,
  mockClaimPendingPaymentForProcessing,
  mockSavePaymentDocument,
  mockFulfillPaidOrder,
  mockEnsurePostPaymentSideEffects,
  mockEnqueueOrderConfirmationEmail,
} = vi.hoisted(() => ({
  mockCompleteIyzicoCheckout: vi.fn(),
  mockFindPaymentByOrderId: vi.fn(),
  mockFindOrderByIdLean: vi.fn(),
  mockClaimPendingPaymentForProcessing: vi.fn(),
  mockSavePaymentDocument: vi.fn(),
  mockFulfillPaidOrder: vi.fn(),
  mockEnsurePostPaymentSideEffects: vi.fn(),
  mockEnqueueOrderConfirmationEmail: vi.fn(),
}));

vi.mock('@/infrastructure/iyzico/retrieve-checkout', () => ({
  completeIyzicoCheckout: (...args: unknown[]) => mockCompleteIyzicoCheckout(...args),
}));

vi.mock('@/repositories/buyers/payment.repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/repositories/buyers/payment.repository')>();
  return {
    ...actual,
    findPaymentByOrderId: (...args: unknown[]) => mockFindPaymentByOrderId(...args),
    findOrderIdByCheckoutToken: vi
      .fn()
      .mockResolvedValue('8c9e6679-7425-40de-944b-e07fc1f90ae8'),
    claimPendingPaymentForProcessing: (...args: unknown[]) =>
      mockClaimPendingPaymentForProcessing(...args),
    savePaymentDocument: (...args: unknown[]) => mockSavePaymentDocument(...args),
  };
});

vi.mock('@/repositories/buyers/order.repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/repositories/buyers/order.repository')>();
  return {
    ...actual,
    findOrderByIdLean: (...args: unknown[]) => mockFindOrderByIdLean(...args),
  };
});

vi.mock('@/domain/orders/fulfill-order', () => ({
  fulfillPaidOrder: (...args: unknown[]) => mockFulfillPaidOrder(...args),
}));

vi.mock('@/domain/payment/post-payment-side-effects', () => ({
  ensurePostPaymentSideEffects: (...args: unknown[]) => mockEnsurePostPaymentSideEffects(...args),
}));

vi.mock('@/domain/orders/enqueue-order-confirmation', () => ({
  enqueueOrderConfirmationEmail: (...args: unknown[]) => mockEnqueueOrderConfirmationEmail(...args),
}));

vi.mock('@/domain/payment/refund-captured-payment', () => ({
  refundCapturedIyzicoPayment: vi.fn(),
}));

vi.mock('@/domain/orders/cancel-pending-order', () => ({
  cancelPendingOrder: vi.fn(),
}));

vi.mock('@/domain/payment/payment-audit', () => ({
  logPaymentTransition: vi.fn(),
}));

const buildPayment = (status: string) => ({
  _id: 'pay-1',
  orderId,
  buyerId,
  amount: 1998,
  currency: 'TRY',
  status,
  provider: 'iyzico',
  externalId: checkoutToken,
  save: vi.fn().mockResolvedValue(undefined),
  toObject: () => ({
    _id: 'pay-1',
    orderId,
    buyerId,
    amount: 1998,
    currency: 'TRY',
    status: 'completed',
    provider: 'iyzico',
    externalId: 'iyzico-payment-id',
  }),
});

describe('payment callback idempotency integration', () => {
  let app: FastifyInstance;
  let paymentState: ReturnType<typeof buildPayment>;
  let orderStatus = 'pending';

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-jwt-secret-with-32-chars-minimum';
    process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    orderStatus = 'pending';
    paymentState = buildPayment('pending');

    mockCompleteIyzicoCheckout.mockResolvedValue({
      status: 'completed',
      orderId,
      externalId: 'iyzico-payment-id',
      paidAmount: 1998,
      itemTransactions: [{ itemId: productId, paymentTransactionId: 'tx-1' }],
    });

    mockFindPaymentByOrderId.mockImplementation(async () => paymentState);
    mockFindOrderByIdLean.mockImplementation(async () => ({
      _id: orderId,
      buyerId,
      status: orderStatus,
      totalAmount: 1998,
      currency: 'TRY',
      items: [{ productId, quantity: 2 }],
    }));

    mockClaimPendingPaymentForProcessing.mockImplementation(async () => {
      if (paymentState.status !== 'pending') {
        return null;
      }

      paymentState = buildPayment('processing');
      return paymentState;
    });

    mockSavePaymentDocument.mockImplementation(async (payment: { status: string }) => {
      if (payment.status === 'completed') {
        paymentState = buildPayment('completed');
      }
    });

    mockFulfillPaidOrder.mockImplementation(async () => {
      orderStatus = 'paid';
    });

    mockEnsurePostPaymentSideEffects.mockResolvedValue(undefined);
    mockEnqueueOrderConfirmationEmail.mockResolvedValue(undefined);
  });

  const postCallback = () =>
    app.inject({
      method: 'POST',
      url: '/payments/callback',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `token=${checkoutToken}`,
    });

  it('aynı callback iki kez gelince fulfill yalnızca bir kez çalışır', async () => {
    const first = await postCallback();
    const second = await postCallback();

    expect(first.statusCode).toBe(303);
    expect(second.statusCode).toBe(303);
    expect(first.headers.location).toContain('payment=success');
    expect(second.headers.location).toContain('payment=success');
    expect(mockFulfillPaidOrder).toHaveBeenCalledTimes(1);
    expect(mockEnsurePostPaymentSideEffects).toHaveBeenCalledTimes(2);
  });
});
