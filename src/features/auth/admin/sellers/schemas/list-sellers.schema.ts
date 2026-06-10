import { z } from 'zod';
import { SELLER_APPROVAL_STATUSES } from '../../../../../db/auth/seller.model';

export const listSellersQuerySchema = z.object({
  status: z.enum(SELLER_APPROVAL_STATUSES).optional(),
});

export type ListSellersQuery = z.infer<typeof listSellersQuerySchema>;
