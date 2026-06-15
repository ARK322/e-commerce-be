import { z } from 'zod';
import { uuidSchema } from '@/lib/common/validation/common-schemas';

export const MAX_PRODUCT_CATEGORIES = 20;

export const productCategoryAssignmentSchema = z
  .object({
    categoryIds: z
      .array(uuidSchema)
      .min(1, 'En az bir kategori seçilmeli')
      .max(MAX_PRODUCT_CATEGORIES, `En fazla ${MAX_PRODUCT_CATEGORIES} kategori seçilebilir`),
    primaryCategoryId: uuidSchema,
  })
  .superRefine((data, ctx) => {
    const uniqueIds = new Set(data.categoryIds);

    if (uniqueIds.size !== data.categoryIds.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'Kategori tekrarı olamaz',
        path: ['categoryIds'],
      });
    }

    if (!uniqueIds.has(data.primaryCategoryId)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Ana kategori seçilen kategoriler arasında olmalı',
        path: ['primaryCategoryId'],
      });
    }
  });

export type ProductCategoryAssignment = z.infer<typeof productCategoryAssignmentSchema>;

export const resolveProductCategoryAssignment = (
  current: ProductCategoryAssignment,
  input: Partial<ProductCategoryAssignment>
): ProductCategoryAssignment => {
  const categoryIds = input.categoryIds ?? current.categoryIds;
  const primaryCategoryId = input.primaryCategoryId ?? current.primaryCategoryId;

  return productCategoryAssignmentSchema.parse({
    categoryIds,
    primaryCategoryId,
  });
};
