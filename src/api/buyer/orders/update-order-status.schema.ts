import { z } from 'zod';

export const updateOrderStatusSchema = z.object({
  status: z.enum(['shipped', 'delivered'], {
    message: 'Durum shipped veya delivered olmalı',
  }),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
