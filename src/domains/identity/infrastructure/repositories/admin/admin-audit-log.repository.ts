import { AdminAuditLog, type AdminAuditAction } from '@/integrations/mongo';

export type CreateAdminAuditLogData = {
  _id: string;
  actorUserId: string;
  action: AdminAuditAction;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown> | null;
};

export const createAdminAuditLog = async (data: CreateAdminAuditLogData) =>
  AdminAuditLog.create(data);

export type ListAdminAuditLogsFilters = {
  action?: AdminAuditAction;
  resourceType?: string;
  resourceId?: string;
  actorUserId?: string;
};

export const listAdminAuditLogsLean = async (
  filters: ListAdminAuditLogsFilters,
  limit: number,
  offset: number
) => {
  const query: Record<string, unknown> = {};

  if (filters.action) {
    query.action = filters.action;
  }

  if (filters.resourceType) {
    query.resourceType = filters.resourceType;
  }

  if (filters.resourceId) {
    query.resourceId = filters.resourceId;
  }

  if (filters.actorUserId) {
    query.actorUserId = filters.actorUserId;
  }

  const [items, total] = await Promise.all([
    AdminAuditLog.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
    AdminAuditLog.countDocuments(query),
  ]);

  return { items, total };
};
