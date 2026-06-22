import { createLogger } from '@/shared/logging';
import { releaseSellerAvailableFromSplit } from '@/domains/payments/application/wallet/release-available-from-split';
import { listApprovedPaymentSplitsLean } from '@/domains/payments/infrastructure/repositories/payment-split.repository';
import { findSellerWalletLedgerEntry } from '@/domains/payments/infrastructure/repositories/seller-wallet.repository';

const log = createLogger({ module: 'reconcile-wallet-releases' });
const RECONCILE_INTERVAL_MS = 10 * 60_000;
const BATCH_LIMIT = 50;

export const reconcileSellerWalletReleases = async (): Promise<number> => {
  const splits = await listApprovedPaymentSplitsLean(BATCH_LIMIT);
  let handled = 0;

  for (const split of splits) {
    const paymentSplitId = String(split._id);
    const existing = await findSellerWalletLedgerEntry(paymentSplitId, 'available_release');

    if (existing) {
      continue;
    }

    try {
      await releaseSellerAvailableFromSplit({
        _id: split._id,
        orderId: String(split.orderId),
        sellerId: String(split.sellerId),
        sellerShare: split.sellerShare,
      });
      handled += 1;
    } catch (error) {
      log.warn(
        { err: error, paymentSplitId, orderId: split.orderId, sellerId: split.sellerId },
        'Onaylı split için available release uzlaştırması başarısız'
      );
    }
  }

  return handled;
};

export const startSellerWalletReconciliationScheduler = (): void => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const run = () => {
    void reconcileSellerWalletReleases()
      .then((count) => {
        if (count > 0) {
          log.info({ count }, 'Eksik available release kayıtları uzlaştırıldı');
        }
      })
      .catch((err) => {
        log.error({ err }, 'Satıcı wallet release uzlaştırma scheduler hatası');
      });
  };

  run();
  setInterval(run, RECONCILE_INTERVAL_MS);
};
