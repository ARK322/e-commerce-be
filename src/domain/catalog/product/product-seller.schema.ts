import { z } from 'zod';
import { safeString, uuidSchema } from '@/shared/validation/common-schemas';
import { slugSchema } from '@/shared/validation/slug-schema';

export const createProductSchema = z
  .object({
    categoryId: uuidSchema,
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
  })
  .strict();

export type CreateProductInput = z.infer<typeof createProductSchema>;

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
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Güncellenecek en az bir alan gerekli',
  })
  .strict();

export type UpdateProductInput = z.infer<typeof updateProductSchema>;
