import { z } from 'zod';

export const createOrderSchema = z.object({
  acceptPriceChanges: z.boolean().optional().default(false),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
