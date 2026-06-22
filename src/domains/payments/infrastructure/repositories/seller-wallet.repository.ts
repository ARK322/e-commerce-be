import { SellerWallet, SellerWalletLedger } from '@/integrations/mongo';

export const findSellerWalletById = async (sellerId: string) => SellerWallet.findById(sellerId);

export const upsertSellerWalletPendingCredit = async (
  sellerId: string,
  amount: number
): Promise<void> => {
  await SellerWallet.findByIdAndUpdate(
    sellerId,
    {
      $inc: { pendingBalance: amount },
      $set: { updatedAt: new Date() },
      $setOnInsert: {
        availableBalance: 0,
        currency: 'TRY',
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
};

export const releaseSellerWalletPendingToAvailable = async (
  sellerId: string,
  amount: number
): Promise<void> => {
  const wallet = await SellerWallet.findById(sellerId);

  if (!wallet) {
    throw new Error(`Seller wallet not found: ${sellerId}`);
  }

  if (wallet.pendingBalance < amount) {
    throw new Error(
      `Insufficient pending balance for seller ${sellerId}: ${wallet.pendingBalance} < ${amount}`
    );
  }

  wallet.pendingBalance = Math.round((wallet.pendingBalance - amount) * 100) / 100;
  wallet.availableBalance = Math.round((wallet.availableBalance + amount) * 100) / 100;
  wallet.updatedAt = new Date();
  await wallet.save();
};

export const createSellerWalletLedgerEntry = async (data: {
  _id: string;
  sellerId: string;
  orderId: string;
  paymentSplitId: string;
  entryType: 'pending_credit' | 'available_release';
  amount: number;
}) => SellerWalletLedger.create(data);

export const findSellerWalletLedgerEntry = async (
  paymentSplitId: string,
  entryType: 'pending_credit' | 'available_release'
) => SellerWalletLedger.findOne({ paymentSplitId, entryType }).lean();

export const listSellerWalletLedgerBySellerIdLean = async (sellerId: string, limit = 20) =>
  SellerWalletLedger.find({ sellerId }).sort({ createdAt: -1 }).limit(limit).lean();
