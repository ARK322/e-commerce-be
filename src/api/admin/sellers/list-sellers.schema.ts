import { z } from 'zod';
import { SELLER_APPROVAL_STATUSES } from '@/integrations/mongo';

export const listSellersQuerySchema = z.object({
  status: z.enum(SELLER_APPROVAL_STATUSES).optional(),
});

export type ListSellersQuery = z.infer<typeof listSellersQuerySchema>;
