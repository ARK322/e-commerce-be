import { Schema, model } from 'mongoose';

export const RETURN_REQUEST_TYPES = ['cancellation', 'return'] as const;
export type ReturnRequestType = (typeof RETURN_REQUEST_TYPES)[number];

export const RETURN_REQUEST_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'refunded',
  'cancelled',
] as const;
export type ReturnRequestStatus = (typeof RETURN_REQUEST_STATUSES)[number];

const stringField = { type: String, trim: true, maxlength: 500 };

const returnItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    reason: { ...stringField, maxlength: 1000 },
  },
  { _id: false, strict: true }
);

const returnRequestSchema = new Schema(
  {
    _id: { type: String, required: true },
    orderId: { type: String, required: true, index: true },
    buyerId: { type: String, required: true, index: true },
    type: { type: String, enum: RETURN_REQUEST_TYPES, required: true },
    status: { type: String, enum: RETURN_REQUEST_STATUSES, default: 'pending' },
    items: { type: [returnItemSchema], required: true },
    buyerNote: { ...stringField, maxlength: 2000 },
    adminNote: { ...stringField, maxlength: 2000 },
    reviewedByAdminId: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    refundPaymentId: { type: String, default: null },
    refundAmount: { type: Number, default: null, min: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { strict: true }
);

returnRequestSchema.index({ buyerId: 1, createdAt: -1 });
returnRequestSchema.index({ orderId: 1, status: 1 });

export const ReturnRequest = model('ReturnRequest', returnRequestSchema);
