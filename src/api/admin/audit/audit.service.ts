import { PERMISSIONS } from '@/domains/identity/application/access/admin/permission-keys';
import { assertPermission } from '@/domains/identity/application/access/admin/permissions';
import type { AdminAccessContext } from '@/domains/identity/application/queries/admin-context';
import { listAdminAuditLogsLean } from '@/domains/identity/infrastructure/repositories/admin/admin-audit-log.repository';
import type { ListAdminAuditLogsQuery } from '@/api/admin/audit/list-audit.schema';

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
