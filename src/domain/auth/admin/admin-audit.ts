import type { AdminAuditAction } from '@/infrastructure/mongo';
import { createAdminAuditLog } from '@/repositories/admin/admin-audit-log.repository';
import { createUserId } from '@/shared/ids';
import { createLogger } from '@/shared/logging';

const log = createLogger({ module: 'admin-audit' });

export type RecordAdminActionInput = {
  actorUserId: string;
  action: AdminAuditAction;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
};

export const recordAdminAction = async (input: RecordAdminActionInput): Promise<void> => {
  await createAdminAuditLog({
    _id: createUserId(),
    actorUserId: input.actorUserId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    metadata: input.metadata ?? null,
  });

  log.info(
    {
      actorUserId: input.actorUserId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      ...(input.metadata ? { metadata: input.metadata } : {}),
    },
    'Admin action recorded'
  );
};
