import { createLogger } from '@/shared/logging';
import { creditSellerPendingFromPaidOrder } from '@/domain/sellers/wallet/credit-pending-from-order';
import { listCompletedIyzicoPaymentsForSplitSyncLean } from '@/repositories/buyers/payment.repository';

const log = createLogger({ module: 'retry-wallet-credits' });
const RETRY_INTERVAL_MS = 5 * 60_000;

export const retryMissingSellerWalletCredits = async (): Promise<number> => {
  const payments = await listCompletedIyzicoPaymentsForSplitSyncLean();
  let handled = 0;

  for (const payment of payments) {
    const orderId = String(payment.orderId);

    try {
      await creditSellerPendingFromPaidOrder(orderId);
      handled += 1;
    } catch (error) {
      log.warn({ err: error, orderId }, 'Satıcı pending bakiye yeniden denemesi başarısız');
    }
  }

  return handled;
};

export const startMissingSellerWalletCreditRetryScheduler = (): void => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const run = () => {
    void retryMissingSellerWalletCredits()
      .then((count) => {
        if (count > 0) {
          log.info({ count }, 'Eksik satıcı pending bakiye kayıtları yeniden denendi');
        }
      })
      .catch((err) => {
        log.error({ err }, 'Satıcı pending bakiye retry scheduler hatası');
      });
  };

  run();
  setInterval(run, RETRY_INTERVAL_MS);
};
