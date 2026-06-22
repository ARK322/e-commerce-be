import { z } from 'zod';
import { uuidSchema } from '@/shared/validation/common-schemas';

export const addToCartSchema = z.object({
  productId: uuidSchema,
  quantity: z
    .number()
    .int('Adet tam sayı olmalı')
    .min(1, 'Adet en az 1 olmalı'),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
