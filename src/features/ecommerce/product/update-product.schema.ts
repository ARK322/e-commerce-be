import { z } from 'zod';
import { safeString, safeUrlSchema, uuidSchema } from '@/lib/common/validation/common-schemas';
import { slugSchema } from '@/lib/common/validation/slug-schema';

export const updateProductSchema = z
  .object({
    categoryId: uuidSchema.optional(),
    name: safeString({
      min: 1,
      max: 200,
      label: 'Ürün adı',
    }).optional(),
    slug: slugSchema.nullable().optional(),
    description: safeString({
      min: 1,
      max: 5000,
      label: 'Açıklama',
    }).nullable().optional(),
    price: z.number().min(0, 'Fiyat 0 veya daha büyük olmalı').optional(),
    stock: z.number().int().min(0, 'Stok 0 veya daha büyük olmalı').optional(),
    minOrderQuantity: z
      .number()
      .int('Minimum sipariş adedi tam sayı olmalı')
      .min(1, 'Minimum sipariş adedi en az 1 olmalı')
      .optional(),
    isActive: z.boolean().optional(),
    images: z.array(safeUrlSchema).max(10, 'En fazla 10 görsel eklenebilir').optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Güncellenecek en az bir alan gerekli',
  });

export type UpdateProductInput = z.infer<typeof updateProductSchema>;
