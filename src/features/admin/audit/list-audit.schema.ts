import { z } from 'zod';
import { ADMIN_AUDIT_ACTIONS } from '@/infrastructure/mongo';
import { uuidSchema } from '@/shared/validation/common-schemas';

export const listAdminAuditLogsQuerySchema = z.object({
  action: z.enum(ADMIN_AUDIT_ACTIONS).optional(),
  resourceType: z.string().trim().min(1).max(64).optional(),
  resourceId: z.string().trim().min(1).max(64).optional(),
  actorUserId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListAdminAuditLogsQuery = z.infer<typeof listAdminAuditLogsQuerySchema>;
