import { Schema, model } from 'mongoose';

export const PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_CURRENCIES = ['TRY'] as const;
export type PaymentCurrency = (typeof PAYMENT_CURRENCIES)[number];

const paymentSchema = new Schema(
  {
    _id: { type: String, required: true },
    orderId: { type: String, required: true },
    buyerId: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: PAYMENT_CURRENCIES, default: 'TRY' },
    provider: { type: String, trim: true, maxlength: 100, default: null },
    externalId: { type: String, trim: true, maxlength: 500, default: null },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { strict: true }
);

paymentSchema.index({ orderId: 1 }, { unique: true });
paymentSchema.index({ buyerId: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });

export const Payment = model('Payment', paymentSchema);
