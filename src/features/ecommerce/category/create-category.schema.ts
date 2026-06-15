import { z } from 'zod';
import { safeString, uuidSchema } from '@/lib/common/validation/common-schemas';
import { slugSchema } from '@/lib/common/validation/slug-schema';

const categoryNameSchema = safeString({
  min: 1,
  max: 200,
  label: 'Kategori adı',
});

export const createCategorySchema = z.object({
  name: categoryNameSchema,
  slug: slugSchema.optional(),
  parentId: uuidSchema.nullable().optional(),
  isActive: z.boolean().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
