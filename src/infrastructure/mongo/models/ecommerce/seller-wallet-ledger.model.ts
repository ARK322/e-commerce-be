import { Schema, model } from 'mongoose';

export const SELLER_WALLET_LEDGER_ENTRY_TYPES = [
  'pending_credit',
  'available_release',
] as const;

export type SellerWalletLedgerEntryType = (typeof SELLER_WALLET_LEDGER_ENTRY_TYPES)[number];

const sellerWalletLedgerSchema = new Schema(
  {
    _id: { type: String, required: true },
    sellerId: { type: String, required: true },
    orderId: { type: String, required: true },
    paymentSplitId: { type: String, required: true },
    entryType: { type: String, enum: SELLER_WALLET_LEDGER_ENTRY_TYPES, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['TRY'], default: 'TRY' },
    createdAt: { type: Date, default: Date.now },
  },
  { strict: true }
);

sellerWalletLedgerSchema.index({ paymentSplitId: 1, entryType: 1 }, { unique: true });
sellerWalletLedgerSchema.index({ sellerId: 1, createdAt: -1 });
sellerWalletLedgerSchema.index({ orderId: 1 });

export const SellerWalletLedger = model('SellerWalletLedger', sellerWalletLedgerSchema);
