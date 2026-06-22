import { createUserId } from '@/shared/ids';
import { createLogger } from '@/shared/logging';
import { isDuplicateKeyError } from '@/domains/identity/application/errors';
import { findPaymentSplitsByOrderIdLean } from '@/domains/payments/infrastructure/repositories/payment-split.repository';
import {
  createSellerWalletLedgerEntry,
  findSellerWalletLedgerEntry,
  upsertSellerWalletPendingCredit,
} from '@/domains/payments/infrastructure/repositories/seller-wallet.repository';

const log = createLogger({ module: 'seller-wallet' });

export const creditSellerPendingFromPaidOrder = async (orderId: string): Promise<void> => {
  const splits = await findPaymentSplitsByOrderIdLean(orderId);

  for (const split of splits) {
    const paymentSplitId = String(split._id);
    const existing = await findSellerWalletLedgerEntry(paymentSplitId, 'pending_credit');

    if (existing) {
      continue;
    }

    try {
      await createSellerWalletLedgerEntry({
        _id: createUserId(),
        sellerId: String(split.sellerId),
        orderId,
        paymentSplitId,
        entryType: 'pending_credit',
        amount: split.sellerShare,
      });
      await upsertSellerWalletPendingCredit(String(split.sellerId), split.sellerShare);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        continue;
      }

      log.error(
        { err: error, orderId, paymentSplitId, sellerId: split.sellerId },
        'Satıcı pending bakiye yazılamadı'
      );
    }
  }
};
