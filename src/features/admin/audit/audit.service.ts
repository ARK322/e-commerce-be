import { PERMISSIONS } from '@/domain/auth/access/admin/permission-keys';
import { assertPermission } from '@/domain/auth/access/admin/permissions';
import type { AdminAccessContext } from '@/domain/auth/queries/admin-context';
import { listAdminAuditLogsLean } from '@/repositories/admin/admin-audit-log.repository';
import type { ListAdminAuditLogsQuery } from '@/features/admin/audit/list-audit.schema';

const toAuditLogResponse = (log: {
  _id: unknown;
  actorUserId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown> | null;
  createdAt?: Date;
}) => ({
  id: String(log._id),
  actorUserId: log.actorUserId,
  action: log.action,
  resourceType: log.resourceType,
  resourceId: log.resourceId,
  metadata: log.metadata ?? null,
  createdAt: log.createdAt,
});

export const listAdminAuditLogs = async (
  ctx: AdminAccessContext,
  query: ListAdminAuditLogsQuery
) => {
  assertPermission(ctx, PERMISSIONS.ADMINS_READ, 'Denetim kayıtlarını görüntüleme yetkin yok');

  const { items, total } = await listAdminAuditLogsLean(
    {
      action: query.action,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      actorUserId: query.actorUserId,
    },
    query.limit,
    query.offset
  );

  return {
    items: items.map(toAuditLogResponse),
    total,
    limit: query.limit,
    offset: query.offset,
  };
};
