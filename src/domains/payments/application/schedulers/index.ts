import { startPaymentReconciliationScheduler } from '@/domains/commerce/application/orders/reconcile-payments';
import { startPaymentSplitSyncRetryScheduler } from '@/domains/commerce/application/orders/retry-payment-split-sync';
import { startStuckPaymentRecoveryScheduler } from '@/domains/commerce/application/orders/recover-stuck-payments';
import { startPaymentSplitApprovalRetryScheduler } from '@/domains/commerce/application/orders/retry-failed-payment-splits';
import { startMissingSellerWalletCreditRetryScheduler } from '@/domains/payments/application/wallet/retry-missing-wallet-credits';
import { startSellerWalletReconciliationScheduler } from '@/domains/payments/application/wallet/reconcile-seller-wallet-releases';

export const startPaymentsSchedulers = (): void => {
  startPaymentReconciliationScheduler();
  startPaymentSplitSyncRetryScheduler();
  startStuckPaymentRecoveryScheduler();
  startPaymentSplitApprovalRetryScheduler();
  startMissingSellerWalletCreditRetryScheduler();
  startSellerWalletReconciliationScheduler();
};
