import { z } from 'zod';

export const updateCartItemSchema = z.object({
  quantity: z
    .number()
    .int('Adet tam sayı olmalı')
    .min(1, 'Adet en az 1 olmalı'),
});

export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
