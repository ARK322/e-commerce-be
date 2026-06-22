import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockFindPaymentByOrderId,
  mockFindOrderByIdLean,
  mockClaimPendingPaymentForProcessing,
  mockSavePaymentDocument,
  mockFulfillPaidOrder,
  mockEnsurePostPaymentSideEffects,
  mockRefundCapturedIyzicoPayment,
  mockCancelPendingOrder,
  mockEnqueueOrderConfirmationEmail,
} = vi.hoisted(() => ({
  mockFindPaymentByOrderId: vi.fn(),
  mockFindOrderByIdLean: vi.fn(),
  mockClaimPendingPaymentForProcessing: vi.fn(),
  mockSavePaymentDocument: vi.fn(),
  mockFulfillPaidOrder: vi.fn(),
  mockEnsurePostPaymentSideEffects: vi.fn(),
  mockRefundCapturedIyzicoPayment: vi.fn(),
  mockCancelPendingOrder: vi.fn(),
  mockEnqueueOrderConfirmationEmail: vi.fn(),
}));

vi.mock('@/domains/payments/infrastructure/repositories/payment.repository', () => ({
  findPaymentByOrderId: (...args: unknown[]) => mockFindPaymentByOrderId(...args),
  claimPendingPaymentForProcessing: (...args: unknown[]) =>
    mockClaimPendingPaymentForProcessing(...args),
  savePaymentDocument: (...args: unknown[]) => mockSavePaymentDocument(...args),
  updatePaymentStatusByOrderId: vi.fn(),
}));

vi.mock('@/domains/commerce/infrastructure/repositories/order.repository', () => ({
  findOrderByIdLean: (...args: unknown[]) => mockFindOrderByIdLean(...args),
}));

vi.mock('@/domains/commerce/application/orders/fulfill-order', () => ({
  fulfillPaidOrder: (...args: unknown[]) => mockFulfillPaidOrder(...args),
}));

vi.mock('@/domains/payments/application/payment/post-payment-side-effects', () => ({
  ensurePostPaymentSideEffects: (...args: unknown[]) => mockEnsurePostPaymentSideEffects(...args),
}));

vi.mock('@/domains/payments/application/payment/refund-captured-payment', () => ({
  refundCapturedIyzicoPayment: (...args: unknown[]) => mockRefundCapturedIyzicoPayment(...args),
}));

vi.mock('@/domains/commerce/application/orders/cancel-pending-order', () => ({
  cancelPendingOrder: (...args: unknown[]) => mockCancelPendingOrder(...args),
}));

vi.mock('@/domains/commerce/application/orders/enqueue-order-confirmation', () => ({
  enqueueOrderConfirmationEmail: (...args: unknown[]) => mockEnqueueOrderConfirmationEmail(...args),
}));

vi.mock('@/domains/payments/application/payment/payment-audit', () => ({
  logPaymentTransition: vi.fn(),
}));

import { finalizeSuccessfulIyzicoCheckout } from '@/domains/payments/application/payment/finalize-checkout-payment';

const orderId = '8c9e6679-7425-40de-944b-e07fc1f90ae8';
const buyerId = '550e8400-e29b-41d4-a716-446655440000';
const productId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

const checkoutResult = {
  status: 'completed' as const,
  orderId,
  externalId: 'iyzico-payment-id',
  paidAmount: 1998,
  itemTransactions: [{ itemId: productId, paymentTransactionId: 'tx-1' }],
};

const pendingOrder = {
  _id: orderId,
  buyerId,
  status: 'pending',
  totalAmount: 1998,
  items: [{ productId, quantity: 2 }],
};

const buildPayment = (status: string) => ({
  _id: 'pay-1',
  orderId,
  buyerId,
  amount: 1998,
  currency: 'TRY',
  status,
  provider: 'iyzico',
  externalId: 'token-1',
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

describe('finalizeSuccessfulIyzicoCheckout idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFulfillPaidOrder.mockResolvedValue(undefined);
    mockEnsurePostPaymentSideEffects.mockResolvedValue(undefined);
    mockSavePaymentDocument.mockResolvedValue(undefined);
    mockEnqueueOrderConfirmationEmail.mockResolvedValue(undefined);
    mockFindOrderByIdLean.mockResolvedValue(pendingOrder);
  });

  it('ilk callback ödemeyi tamamlar ve fulfill eder', async () => {
    mockFindPaymentByOrderId.mockResolvedValue(buildPayment('pending'));
    mockClaimPendingPaymentForProcessing.mockResolvedValue(buildPayment('processing'));

    const result = await finalizeSuccessfulIyzicoCheckout(checkoutResult);

    expect(result.success).toBe(true);
    expect(mockFulfillPaidOrder).toHaveBeenCalledTimes(1);
    expect(mockEnsurePostPaymentSideEffects).toHaveBeenCalledTimes(1);
  });

  it('completed payment + paid order tekrarında fulfill etmez', async () => {
    mockFindPaymentByOrderId.mockResolvedValue(buildPayment('completed'));
    mockFindOrderByIdLean.mockResolvedValue({ ...pendingOrder, status: 'paid' });

    const result = await finalizeSuccessfulIyzicoCheckout(checkoutResult);

    expect(result.success).toBe(true);
    expect(mockFulfillPaidOrder).not.toHaveBeenCalled();
    expect(mockClaimPendingPaymentForProcessing).not.toHaveBeenCalled();
    expect(mockEnsurePostPaymentSideEffects).toHaveBeenCalledTimes(1);
  });

  it('processing + order zaten paid ise fulfill atlanır', async () => {
    const payment = buildPayment('processing');
    mockFindPaymentByOrderId.mockResolvedValue(payment);
    mockFindOrderByIdLean.mockResolvedValue({ ...pendingOrder, status: 'paid' });

    const result = await finalizeSuccessfulIyzicoCheckout(checkoutResult);

    expect(result.success).toBe(true);
    expect(mockClaimPendingPaymentForProcessing).not.toHaveBeenCalled();
    expect(mockFulfillPaidOrder).not.toHaveBeenCalled();
    expect(mockEnsurePostPaymentSideEffects).toHaveBeenCalledTimes(1);
  });

  it('concurrent claim kaybedilirse processing path ile devam eder', async () => {
    const processingPayment = buildPayment('processing');
    mockFindPaymentByOrderId
      .mockResolvedValueOnce(buildPayment('pending'))
      .mockResolvedValueOnce(processingPayment);
    mockClaimPendingPaymentForProcessing.mockResolvedValue(null);

    const result = await finalizeSuccessfulIyzicoCheckout(checkoutResult);

    expect(result.success).toBe(true);
    expect(mockFulfillPaidOrder).toHaveBeenCalledTimes(1);
  });

  it('tutar uyuşmazlığında iade eder ve fulfill etmez', async () => {
    mockFindPaymentByOrderId.mockResolvedValue(buildPayment('processing'));
    mockFindOrderByIdLean.mockResolvedValue({ ...pendingOrder, totalAmount: 5000 });
    mockRefundCapturedIyzicoPayment.mockResolvedValue(undefined);

    const result = await finalizeSuccessfulIyzicoCheckout(checkoutResult);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe('order_not_payable');
    }
    expect(mockFulfillPaidOrder).not.toHaveBeenCalled();
    expect(mockRefundCapturedIyzicoPayment).toHaveBeenCalled();
  });

  it('iptal edilmiş siparişte ödeme yakalanmışsa iade eder', async () => {
    mockFindPaymentByOrderId.mockResolvedValue(buildPayment('pending'));
    mockClaimPendingPaymentForProcessing.mockResolvedValue(buildPayment('processing'));
    mockFindOrderByIdLean.mockResolvedValue({ ...pendingOrder, status: 'cancelled' });
    mockRefundCapturedIyzicoPayment.mockResolvedValue(undefined);

    const result = await finalizeSuccessfulIyzicoCheckout(checkoutResult);

    expect(result.success).toBe(false);
    expect(mockRefundCapturedIyzicoPayment).toHaveBeenCalledWith(
      expect.anything(),
      'iyzico-payment-id',
      'order_cancelled_refund'
    );
  });
});
