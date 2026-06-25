import { describe, expect, it, vi } from 'vitest';

const mockStartPendingOrderExpiryScheduler = vi.fn();
const mockStartPaymentReconciliationScheduler = vi.fn();
const mockStartPaymentSplitSyncRetryScheduler = vi.fn();
const mockStartStuckPaymentRecoveryScheduler = vi.fn();
const mockStartOutboxProcessorScheduler = vi.fn();
const mockStartPaymentSplitApprovalRetryScheduler = vi.fn();
const mockStartMissingSellerWalletCreditRetryScheduler = vi.fn();
const mockStartSellerWalletReconciliationScheduler = vi.fn();
const mockStartUnverifiedUserExpiryScheduler = vi.fn();

vi.mock('@/domain/orders/expire-pending-orders', () => ({
  startPendingOrderExpiryScheduler: (...args: unknown[]) =>
    mockStartPendingOrderExpiryScheduler(...args),
}));

vi.mock('@/domain/orders/reconcile-payments', () => ({
  startPaymentReconciliationScheduler: (...args: unknown[]) =>
    mockStartPaymentReconciliationScheduler(...args),
}));

vi.mock('@/domain/orders/retry-payment-split-sync', () => ({
  startPaymentSplitSyncRetryScheduler: (...args: unknown[]) =>
    mockStartPaymentSplitSyncRetryScheduler(...args),
}));

vi.mock('@/domain/orders/recover-stuck-payments', () => ({
  startStuckPaymentRecoveryScheduler: (...args: unknown[]) =>
    mockStartStuckPaymentRecoveryScheduler(...args),
}));

vi.mock('@/domain/notification/outbox/process-outbox-events', () => ({
  startOutboxProcessorScheduler: (...args: unknown[]) => mockStartOutboxProcessorScheduler(...args),
}));

vi.mock('@/domain/orders/retry-failed-payment-splits', () => ({
  startPaymentSplitApprovalRetryScheduler: (...args: unknown[]) =>
    mockStartPaymentSplitApprovalRetryScheduler(...args),
}));

vi.mock('@/domain/sellers/wallet/retry-missing-wallet-credits', () => ({
  startMissingSellerWalletCreditRetryScheduler: (...args: unknown[]) =>
    mockStartMissingSellerWalletCreditRetryScheduler(...args),
}));

vi.mock('@/domain/sellers/wallet/reconcile-seller-wallet-releases', () => ({
  startSellerWalletReconciliationScheduler: (...args: unknown[]) =>
    mockStartSellerWalletReconciliationScheduler(...args),
}));

vi.mock('@/domain/auth/register/expire-unverified-users', () => ({
  startUnverifiedUserExpiryScheduler: (...args: unknown[]) =>
    mockStartUnverifiedUserExpiryScheduler(...args),
}));

import { startSchedulers } from '@/bootstrap/start-schedulers';

describe('startSchedulers', () => {
  it('tüm arka plan zamanlayıcılarını başlatır', () => {
    startSchedulers();

    expect(mockStartPendingOrderExpiryScheduler).toHaveBeenCalled();
    expect(mockStartPaymentReconciliationScheduler).toHaveBeenCalled();
    expect(mockStartPaymentSplitSyncRetryScheduler).toHaveBeenCalled();
    expect(mockStartStuckPaymentRecoveryScheduler).toHaveBeenCalled();
    expect(mockStartPaymentSplitApprovalRetryScheduler).toHaveBeenCalled();
    expect(mockStartMissingSellerWalletCreditRetryScheduler).toHaveBeenCalled();
    expect(mockStartSellerWalletReconciliationScheduler).toHaveBeenCalled();
    expect(mockStartOutboxProcessorScheduler).toHaveBeenCalled();
    expect(mockStartUnverifiedUserExpiryScheduler).toHaveBeenCalled();
  });
});
