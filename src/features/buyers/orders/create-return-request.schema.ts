import { z } from 'zod';
import { RETURN_REQUEST_TYPES } from '@/infrastructure/mongo';
import { safeString } from '@/shared/validation/common-schemas';

export const createReturnRequestSchema = z.object({
  type: z.enum(RETURN_REQUEST_TYPES),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1),
        reason: safeString({ min: 3, max: 1000, label: 'Sebep' }).optional(),
      })
    )
    .min(1),
  buyerNote: safeString({ min: 3, max: 2000, label: 'Not' }).optional(),
});

export type CreateReturnRequestBody = z.infer<typeof createReturnRequestSchema>;
