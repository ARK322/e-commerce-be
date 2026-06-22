import type { PaymentStatus } from '@/infrastructure/mongo';
import { PaymentAuditLog } from '@/infrastructure/mongo';

export const createPaymentAuditLog = async (data: {
  _id: string;
  paymentId: string;
  orderId: string;
  fromStatus: PaymentStatus;
  toStatus: PaymentStatus;
  reason: string;
  metadata?: Record<string, unknown> | null;
}) => PaymentAuditLog.create(data);

export const listPaymentAuditLogsByOrderIdLean = async (
  filters: { orderId?: string; paymentId?: string },
  limit = 50,
  offset = 0
) => {
  const query: Record<string, string> = {};

  if (filters.orderId) {
    query.orderId = filters.orderId;
  }

  if (filters.paymentId) {
    query.paymentId = filters.paymentId;
  }

  const [items, total] = await Promise.all([
    PaymentAuditLog.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
    PaymentAuditLog.countDocuments(query),
  ]);

  return { items, total };
};
