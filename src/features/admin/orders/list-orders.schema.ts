import { z } from 'zod';
import { ORDER_STATUSES } from '@/infrastructure/mongo';
import { uuidSchema } from '@/shared/validation/common-schemas';

export const listAdminOrdersQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  buyerId: uuidSchema.optional(),
  sellerId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListAdminOrdersQuery = z.infer<typeof listAdminOrdersQuerySchema>;
