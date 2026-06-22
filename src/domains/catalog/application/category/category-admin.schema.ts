import { z } from 'zod';
import { safeString, uuidSchema } from '@/shared/validation/common-schemas';
import { slugSchema } from '@/shared/validation/slug-schema';
import { MAX_PARENTS_PER_NODE } from '@/domains/catalog/application/category/category-graph';

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

export const linkCategorySchema = z
  .object({
    parentId: uuidSchema.optional(),
    childId: uuidSchema.optional(),
  })
  .refine((data) => data.parentId !== undefined || data.childId !== undefined, {
    message: 'parentId veya childId gerekli',
  })
  .refine((data) => !(data.parentId && data.childId), {
    message: 'Tek seferde yalnızca parentId veya childId gönderilebilir',
  });

export type LinkCategoryInput = z.infer<typeof linkCategorySchema>;

export const updateCategorySchema = z
  .object({
    name: categoryNameSchema.optional(),
    slug: slugSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Güncellenecek en az bir alan gerekli',
  });

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
