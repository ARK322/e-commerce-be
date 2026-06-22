import { z } from 'zod';
import { uuidSchema } from '@/shared/validation/common-schemas';

export const createPaymentSchema = z.object({
  orderId: uuidSchema,
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
