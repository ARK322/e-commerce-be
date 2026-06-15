import { z } from 'zod';
import { safeString, safeUrlSchema } from '@/lib/common/validation/common-schemas';
import { slugSchema } from '@/lib/common/validation/slug-schema';
import { productCategoryAssignmentSchema } from '@/features/ecommerce/product/product-category.schema';

export const createProductSchema = productCategoryAssignmentSchema.extend({
  name: safeString({
    min: 1,
    max: 200,
    label: 'Ürün adı',
  }),
  slug: slugSchema.optional(),
  description: safeString({
    min: 1,
    max: 5000,
    label: 'Açıklama',
  }).optional(),
  price: z
    .number({ error: 'Fiyat zorunlu' })
    .min(0, 'Fiyat 0 veya daha büyük olmalı'),
  stock: z.number().int().min(0, 'Stok 0 veya daha büyük olmalı').default(0),
  isActive: z.boolean().optional(),
  images: z.array(safeUrlSchema).max(10, 'En fazla 10 görsel eklenebilir').optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
