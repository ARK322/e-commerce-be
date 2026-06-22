import { Schema, model } from 'mongoose';

export const SELLER_WALLET_CURRENCIES = ['TRY'] as const;
export type SellerWalletCurrency = (typeof SELLER_WALLET_CURRENCIES)[number];

const sellerWalletSchema = new Schema(
  {
    _id: { type: String, required: true },
    pendingBalance: { type: Number, required: true, min: 0, default: 0 },
    availableBalance: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, enum: SELLER_WALLET_CURRENCIES, default: 'TRY' },
    updatedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
  },
  { strict: true }
);

export const SellerWallet = model('SellerWallet', sellerWalletSchema);
