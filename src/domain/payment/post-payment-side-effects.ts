import { createLogger } from '@/shared/logging';
import { enqueueOpsAlert } from '@/shared/outbox/ops-alert';
import { OUTBOX_EVENT_TYPES } from '@/shared/outbox/enqueue-outbox-event';
import { syncPaymentSplitTransactionIds } from '@/domain/payment/payment-split';
import { creditSellerPendingFromPaidOrder } from '@/domain/sellers/wallet/credit-pending-from-order';

const log = createLogger({ module: 'post-payment-side-effects' });

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const runWithRetry = async (
  label: string,
  orderId: string,
  operation: () => Promise<void>
): Promise<boolean> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await operation();
      return true;
    } catch (error) {
      lastError = error;
      log.warn({ err: error, orderId, attempt, label }, 'Post-payment yan etkisi başarısız');

      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  log.error({ err: lastError, orderId, label }, 'Post-payment yan etkisi tüm denemelerde başarısız');

  await enqueueOpsAlert(OUTBOX_EVENT_TYPES.OPS_PAYMENT_SIDE_EFFECTS_FAILED, {
    orderId,
    label,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });

  return false;
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
