import { createLogger } from '@/internal/common/logging';
import { syncPaymentSplitTransactionIds } from '@/internal/buyers/payment/payment-split';
import { creditSellerPendingFromPaidOrder } from '@/internal/sellers/wallet/credit-pending-from-order';

const log = createLogger({ module: 'post-payment-side-effects' });

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const runWithRetry = async (
  label: string,
  orderId: string,
  operation: () => Promise<void>
): Promise<void> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await operation();
      return;
    } catch (error) {
      lastError = error;
      log.warn({ err: error, orderId, attempt, label }, 'Post-payment yan etkisi başarısız');

      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  log.error({ err: lastError, orderId, label }, 'Post-payment yan etkisi tüm denemelerde başarısız');
};

export const ensurePostPaymentSideEffects = async (
  orderId: string,
  itemTransactions: Array<{ itemId: string; paymentTransactionId: string }>
): Promise<void> => {
  if (itemTransactions.length > 0) {
    await runWithRetry('split_transaction_sync', orderId, () =>
      syncPaymentSplitTransactionIds(orderId, itemTransactions)
    );
  }

  await runWithRetry('seller_wallet_pending_credit', orderId, () =>
    creditSellerPendingFromPaidOrder(orderId)
  );
};
