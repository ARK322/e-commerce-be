import { z } from 'zod';
import { safeString, uuidSchema } from '@/internal/common/validation/common-schemas';

export const listProductsQuerySchema = z.object({
  categoryId: uuidSchema.optional(),
  search: safeString({
    min: 1,
    max: 200,
    label: 'Arama',
  }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
