import { startPendingOrderExpiryScheduler } from '@/domain/orders/expire-pending-orders';
import { startPaymentReconciliationScheduler } from '@/domain/orders/reconcile-payments';
import { startPaymentSplitSyncRetryScheduler } from '@/domain/orders/retry-payment-split-sync';
import { startStuckPaymentRecoveryScheduler } from '@/domain/orders/recover-stuck-payments';
import { startOutboxProcessorScheduler } from '@/domain/notification/outbox/process-outbox-events';
import { startPaymentSplitApprovalRetryScheduler } from '@/domain/orders/retry-failed-payment-splits';
import { startMissingSellerWalletCreditRetryScheduler } from '@/domain/sellers/wallet/retry-missing-wallet-credits';
import { startSellerWalletReconciliationScheduler } from '@/domain/sellers/wallet/reconcile-seller-wallet-releases';
import { startUnverifiedUserExpiryScheduler } from '@/domain/auth/register/expire-unverified-users';

export const startSchedulers = (): void => {
  startPendingOrderExpiryScheduler();
  startPaymentReconciliationScheduler();
  startPaymentSplitSyncRetryScheduler();
  startStuckPaymentRecoveryScheduler();
  startPaymentSplitApprovalRetryScheduler();
  startMissingSellerWalletCreditRetryScheduler();
  startSellerWalletReconciliationScheduler();
  startOutboxProcessorScheduler();
  startUnverifiedUserExpiryScheduler();
};
