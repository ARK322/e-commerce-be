import { z } from 'zod';
import { safeString } from '@/shared/validation/common-schemas';

export const rejectSellerSchema = z.object({
  reason: safeString({ min: 5, max: 500, label: 'Red sebebi' }),
});

export type RejectSellerInput = z.infer<typeof rejectSellerSchema>;
