import { z } from 'zod';
import { safeString, uuidSchema } from '@/lib/common/validation/common-schemas';
import { slugSchema } from '@/lib/common/validation/slug-schema';
import { MAX_PARENTS_PER_NODE } from '@/features/ecommerce/category/category-graph';

const categoryNameSchema = safeString({
  min: 1,
  max: 200,
  label: 'Kategori adı',
});

export const createCategorySchema = z.object({
  name: categoryNameSchema,
  slug: slugSchema.optional(),
  parentIds: z
    .array(uuidSchema)
    .max(MAX_PARENTS_PER_NODE, `En fazla ${MAX_PARENTS_PER_NODE} üst kategori bağlanabilir`)
    .optional(),
  isActive: z.boolean().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
