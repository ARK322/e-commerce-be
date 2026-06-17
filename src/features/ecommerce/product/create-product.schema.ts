import { z } from 'zod';
import { safeString } from '@/lib/common/validation/common-schemas';
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
  minOrderQuantity: z
    .number()
    .int('Minimum sipariş adedi tam sayı olmalı')
    .min(1, 'Minimum sipariş adedi en az 1 olmalı')
    .default(1),
  isActive: z.boolean().optional(),
}).strict();

export type CreateProductInput = z.infer<typeof createProductSchema>;
