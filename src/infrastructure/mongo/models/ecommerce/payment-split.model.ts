import { Schema, model } from 'mongoose';

export const PAYMENT_SPLIT_APPROVAL_STATUSES = ['pending', 'approved', 'failed'] as const;
export type PaymentSplitApprovalStatus = (typeof PAYMENT_SPLIT_APPROVAL_STATUSES)[number];

const paymentSplitSchema = new Schema(
  {
    _id: { type: String, required: true },
    orderId: { type: String, required: true },
    productId: { type: String, required: true },
    sellerId: { type: String, required: true },
    subtotal: { type: Number, required: true, min: 0 },
    commissionAmount: { type: Number, required: true, min: 0 },
    sellerShare: { type: Number, required: true, min: 0 },
    paymentTransactionId: { type: String, trim: true, maxlength: 100, default: null },
    approvalStatus: {
      type: String,
      enum: PAYMENT_SPLIT_APPROVAL_STATUSES,
      default: 'pending',
    },
    approvedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { strict: true }
);

paymentSplitSchema.index({ orderId: 1, productId: 1 }, { unique: true });
paymentSplitSchema.index({ orderId: 1 });
paymentSplitSchema.index({ sellerId: 1, approvalStatus: 1 });

export const PaymentSplit = model('PaymentSplit', paymentSplitSchema);
