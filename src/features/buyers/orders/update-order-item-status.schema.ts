import { z } from 'zod';

export const updateOrderItemStatusSchema = z.object({
  status: z.enum(['shipped', 'delivered'], {
    message: 'Durum shipped veya delivered olmalı',
  }),
});

export type UpdateOrderItemStatusInput = z.infer<typeof updateOrderItemStatusSchema>;

export const orderItemParamsSchema = z.object({
  orderId: z.string().uuid(),
  productId: z.string().uuid(),
});
