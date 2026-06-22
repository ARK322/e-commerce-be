import { PERMISSIONS } from '@/domain/auth/access/admin/permission-keys';
import { assertPermission } from '@/domain/auth/access/admin/permissions';
import type { AdminAccessContext } from '@/domain/auth/queries/admin-context';
import { listPaymentAuditLogsByOrderIdLean } from '@/repositories/buyers/payment-audit-log.repository';
import type { ListPaymentAuditLogsQuery } from '@/features/admin/payment-audit/list-payment-audit.schema';
import { CommerceError } from '@/shared/errors/commerce-error';

const toPaymentAuditLogResponse = (log: {
  _id: unknown;
  paymentId: string;
  orderId: string;
  fromStatus: string;
  toStatus: string;
  reason: string;
  metadata?: Record<string, unknown> | null;
  createdAt?: Date;
}) => ({
  id: String(log._id),
  paymentId: log.paymentId,
  orderId: log.orderId,
  fromStatus: log.fromStatus,
  toStatus: log.toStatus,
  reason: log.reason,
  metadata: log.metadata ?? null,
  createdAt: log.createdAt,
});

export const listPaymentAuditLogs = async (
  ctx: AdminAccessContext,
  query: ListPaymentAuditLogsQuery
) => {
  assertPermission(ctx, PERMISSIONS.ADMINS_READ, 'Ödeme denetim kayıtlarını görüntüleme yetkin yok');

  if (!query.orderId && !query.paymentId) {
    throw new CommerceError(400, 'orderId veya paymentId filtresi gerekli');
  }

  const { items, total } = await listPaymentAuditLogsByOrderIdLean(
    { orderId: query.orderId, paymentId: query.paymentId },
    query.limit,
    query.offset
  );

  return {
    items: items.map(toPaymentAuditLogResponse),
    total,
    limit: query.limit,
    offset: query.offset,
  };
};
