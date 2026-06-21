import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockSyncPaymentSplitTransactionIds,
  mockCreditSellerPendingFromPaidOrder,
} = vi.hoisted(() => ({
  mockSyncPaymentSplitTransactionIds: vi.fn(),
  mockCreditSellerPendingFromPaidOrder: vi.fn(),
}));

vi.mock('@/internal/buyers/payment/payment-split', () => ({
  syncPaymentSplitTransactionIds: (...args: unknown[]) =>
    mockSyncPaymentSplitTransactionIds(...args),
}));

vi.mock('@/internal/sellers/wallet/credit-pending-from-order', () => ({
  creditSellerPendingFromPaidOrder: (...args: unknown[]) =>
    mockCreditSellerPendingFromPaidOrder(...args),
}));

const mockEnqueueOpsAlert = vi.fn();

vi.mock('@/internal/common/outbox/ops-alert', () => ({
  enqueueOpsAlert: (...args: unknown[]) => mockEnqueueOpsAlert(...args),
}));

import { ensurePostPaymentSideEffects } from '@/internal/buyers/payment/post-payment-side-effects';

const orderId = '8c9e6679-7425-40de-944b-e07fc1f90ae8';

describe('ensurePostPaymentSideEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSyncPaymentSplitTransactionIds.mockResolvedValue(undefined);
    mockCreditSellerPendingFromPaidOrder.mockResolvedValue(undefined);
    mockEnqueueOpsAlert.mockResolvedValue(undefined);
  });

  it('split sync ve wallet credit çağırır', async () => {
    const itemTransactions = [{ itemId: 'item-1', paymentTransactionId: 'tx-1' }];

    await ensurePostPaymentSideEffects(orderId, itemTransactions);

    expect(mockSyncPaymentSplitTransactionIds).toHaveBeenCalledWith(orderId, itemTransactions);
    expect(mockCreditSellerPendingFromPaidOrder).toHaveBeenCalledWith(orderId);
  });

  it('split sync geçici hata verirse yeniden dener', async () => {
    mockSyncPaymentSplitTransactionIds
      .mockRejectedValueOnce(new Error('sync failed'))
      .mockResolvedValueOnce(undefined);

    await ensurePostPaymentSideEffects(orderId, [
      { itemId: 'item-1', paymentTransactionId: 'tx-1' },
    ]);

    expect(mockSyncPaymentSplitTransactionIds).toHaveBeenCalledTimes(2);
    expect(mockCreditSellerPendingFromPaidOrder).toHaveBeenCalledWith(orderId);
  });

  it('itemTransactions boşsa yalnızca wallet credit çağırır', async () => {
    await ensurePostPaymentSideEffects(orderId, []);

    expect(mockSyncPaymentSplitTransactionIds).not.toHaveBeenCalled();
    expect(mockCreditSellerPendingFromPaidOrder).toHaveBeenCalledWith(orderId);
  });

  it('tüm denemeler başarısız olursa ops alert kuyruğuna alır', async () => {
    mockCreditSellerPendingFromPaidOrder.mockRejectedValue(new Error('wallet down'));

    await ensurePostPaymentSideEffects(orderId, []);

    expect(mockEnqueueOpsAlert).toHaveBeenCalled();
  });
});
