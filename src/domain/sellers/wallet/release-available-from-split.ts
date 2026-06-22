import { createUserId } from '@/shared/ids';
import { createLogger } from '@/shared/logging';
import { isDuplicateKeyError } from '@/domain/auth/errors';
import {
  createSellerWalletLedgerEntry,
  findSellerWalletLedgerEntry,
  releaseSellerWalletPendingToAvailable,
} from '@/repositories/sellers/seller-wallet.repository';

const log = createLogger({ module: 'seller-wallet' });

type SplitForWalletRelease = {
  _id: unknown;
  orderId: string;
  sellerId: string;
  sellerShare: number;
};

export const releaseSellerAvailableFromSplit = async (
  split: SplitForWalletRelease
): Promise<void> => {
  const paymentSplitId = String(split._id);
  const existing = await findSellerWalletLedgerEntry(paymentSplitId, 'available_release');

  if (existing) {
    return;
  }

  try {
    await createSellerWalletLedgerEntry({
      _id: createUserId(),
      sellerId: String(split.sellerId),
      orderId: String(split.orderId),
      paymentSplitId,
      entryType: 'available_release',
      amount: split.sellerShare,
    });
    await releaseSellerWalletPendingToAvailable(String(split.sellerId), split.sellerShare);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return;
    }

    log.error(
      { err: error, paymentSplitId, sellerId: split.sellerId, orderId: split.orderId },
      'Satıcı available bakiye serbest bırakılamadı'
    );
    throw error;
  }
};
