import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCompleteIyzicoCheckout = vi.fn();
const mockFinalizeSuccessful = vi.fn();
const mockFinalizeFailed = vi.fn();
const mockRefundCaptured = vi.fn();
const mockFindOrderByIdLean = vi.fn();
const mockFindPaymentById = vi.fn();
const mockListCompleted = vi.fn();
const mockListProcessing = vi.fn();
const mockUpdatePaymentById = vi.fn();

vi.mock('@/integrations/iyzico/retrieve-checkout', () => ({
  completeIyzicoCheckout: (...args: unknown[]) => mockCompleteIyzicoCheckout(...args),
}));

vi.mock('@/domains/payments/application/payment/finalize-checkout-payment', () => ({
  finalizeSuccessfulIyzicoCheckout: (...args: unknown[]) => mockFinalizeSuccessful(...args),
  finalizeFailedIyzicoCheckout: (...args: unknown[]) => mockFinalizeFailed(...args),
}));

vi.mock('@/domains/payments/application/payment/refund-captured-payment', () => ({
  refundCapturedIyzicoPayment: (...args: unknown[]) => mockRefundCaptured(...args),
}));

vi.mock('@/domains/commerce/infrastructure/repositories/order.repository', () => ({
  findOrderByIdLean: (...args: unknown[]) => mockFindOrderByIdLean(...args),
}));

vi.mock('@/domains/payments/infrastructure/repositories/payment.repository', () => ({
  findPaymentById: (...args: unknown[]) => mockFindPaymentById(...args),
  listCompletedIyzicoPaymentsLean: (...args: unknown[]) => mockListCompleted(...args),
  listProcessingIyzicoPaymentsLean: (...args: unknown[]) => mockListProcessing(...args),
  updatePaymentById: (...args: unknown[]) => mockUpdatePaymentById(...args),
}));

import { reconcilePaymentOrderMismatches } from '@/domains/commerce/application/orders/reconcile-payments';

const paymentId = 'pay-1';
const orderId = 'order-1';

const processingPayment = {
  _id: paymentId,
  orderId,
  amount: 100,
  externalId: 'checkout-token',
};

const completedCheckout = {
  status: 'completed' as const,
  orderId,
  externalId: 'iyzico-payment-id',
  paidAmount: 100,
  itemTransactions: [],
};

describe('reconcilePaymentOrderMismatches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListCompleted.mockResolvedValue([]);
    mockListProcessing.mockResolvedValue([{ _id: paymentId }]);
    mockFindPaymentById.mockResolvedValue(processingPayment);
    mockCompleteIyzicoCheckout.mockResolvedValue(completedCheckout);
    mockFinalizeSuccessful.mockResolvedValue(undefined);
    mockFinalizeFailed.mockResolvedValue(undefined);
    mockRefundCaptured.mockResolvedValue(undefined);
    mockUpdatePaymentById.mockResolvedValue(undefined);
  });

  it('paid sipariş + processing ödemede finalize çağırır, iade etmez', async () => {
    mockFindOrderByIdLean.mockResolvedValue({ status: 'paid' });

    const handled = await reconcilePaymentOrderMismatches();

    expect(handled).toBe(1);
    expect(mockFinalizeSuccessful).toHaveBeenCalledWith(completedCheckout);
    expect(mockRefundCaptured).not.toHaveBeenCalled();
  });

  it('pending sipariş + başarılı iyzico sonucunda finalize çağırır', async () => {
    mockFindOrderByIdLean.mockResolvedValue({ status: 'pending' });

    await reconcilePaymentOrderMismatches();

    expect(mockFinalizeSuccessful).toHaveBeenCalledWith(completedCheckout);
    expect(mockRefundCaptured).not.toHaveBeenCalled();
  });

  it('iptal siparişte iade eder', async () => {
    mockFindOrderByIdLean.mockResolvedValue({ status: 'cancelled' });

    await reconcilePaymentOrderMismatches();

    expect(mockRefundCaptured).toHaveBeenCalledWith(
      processingPayment,
      'iyzico-payment-id',
      'order_cancelled_refund'
    );
    expect(mockFinalizeSuccessful).not.toHaveBeenCalled();
  });
});
