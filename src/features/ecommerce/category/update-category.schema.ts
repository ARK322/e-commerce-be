import { z } from 'zod';
import { safeString } from '@/lib/common/validation/common-schemas';
import { slugSchema } from '@/lib/common/validation/slug-schema';

const categoryNameSchema = safeString({
  min: 1,
  max: 200,
  label: 'Kategori adı',
});

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
