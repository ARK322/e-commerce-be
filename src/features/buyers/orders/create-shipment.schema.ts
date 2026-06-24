import { z } from 'zod';
import { SHIPMENT_CARRIERS } from '@/infrastructure/mongo';
import { safeString } from '@/shared/validation/common-schemas';

export const createShipmentSchema = z.object({
  trackingNumber: safeString({ min: 3, max: 100, label: 'Takip numarası' }),
  carrier: z.enum(SHIPMENT_CARRIERS, { message: 'Geçerli bir kargo firması seçin' }),
  productIds: z.array(z.string().uuid()).optional(),
  notes: safeString({ min: 1, max: 1000, label: 'Not' }).optional(),
});

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
