import { Schema, model } from 'mongoose';
import { PAYMENT_STATUSES } from '@/integrations/mongo/models/ecommerce/payment.model';
import type { PaymentStatus } from '@/integrations/mongo/models/ecommerce/payment.model';

const paymentAuditLogSchema = new Schema(
  {
    _id: { type: String, required: true },
    paymentId: { type: String, required: true },
    orderId: { type: String, required: true },
    fromStatus: { type: String, enum: PAYMENT_STATUSES, required: true },
    toStatus: { type: String, enum: PAYMENT_STATUSES, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 200 },
    metadata: { type: Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { strict: true }
);

paymentAuditLogSchema.index({ orderId: 1, createdAt: -1 });
paymentAuditLogSchema.index({ paymentId: 1, createdAt: -1 });

export const PaymentAuditLog = model('PaymentAuditLog', paymentAuditLogSchema);
export type { PaymentStatus };
