import { z } from 'zod';
import { uuidSchema } from '@/shared/validation/common-schemas';
import { listSupportTicketsQuerySchema } from '@/features/support/support-query.schemas';

export const adminListSupportTicketsQuerySchema = listSupportTicketsQuerySchema.extend({
  buyerId: uuidSchema.optional(),
  sellerId: uuidSchema.optional(),
});

export type AdminListSupportTicketsQuery = z.infer<typeof adminListSupportTicketsQuerySchema>;
