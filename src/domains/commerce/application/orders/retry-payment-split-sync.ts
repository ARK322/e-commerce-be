import { retrieveIyzicoPaymentItemTransactions } from '@/integrations/iyzico/retrieve-payment-detail';
import { syncPaymentSplitTransactionIds } from '@/domains/payments/application/payment/payment-split';
import { createLogger } from '@/shared/logging';
import { paymentSplitWithNullTransactionExists } from '@/domains/payments/infrastructure/repositories/payment-split.repository';
import { listCompletedIyzicoPaymentsForSplitSyncLean } from '@/domains/payments/infrastructure/repositories/payment.repository';

const log = createLogger({ module: 'payment-split-sync-retry' });
const RETRY_INTERVAL_MS = 5 * 60_000;

export const retryMissingPaymentSplitTransactionIds = async (): Promise<number> => {
  const payments = await listCompletedIyzicoPaymentsForSplitSyncLean();

  let synced = 0;

  for (const payment of payments) {
    const orderId = String(payment.orderId);
    const paymentId = payment.externalId ? String(payment.externalId) : null;

    if (!paymentId) {
      continue;
    }

    const needsSync = await paymentSplitWithNullTransactionExists(orderId);
    if (!needsSync) {
      continue;
    }

    try {
      const itemTransactions = await retrieveIyzicoPaymentItemTransactions(paymentId, orderId);
      await syncPaymentSplitTransactionIds(orderId, itemTransactions);
      synced += 1;
    } catch (err) {
      log.error({ err, orderId }, 'Split transaction retry başarısız');
    }
  }

  return synced;
};

export const startPaymentSplitSyncRetryScheduler = (): void => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const run = () => {
    void retryMissingPaymentSplitTransactionIds()
      .then((count) => {
        if (count > 0) {
          log.info({ count }, 'Eksik split transaction id senkronizasyonu tamamlandı');
        }
      })
      .catch((err) => {
        log.error({ err }, 'Split transaction retry scheduler hatası');
      });
  };

  run();
  setInterval(run, RETRY_INTERVAL_MS);
};
