import { z } from 'zod';
import { phoneSchema, safeString } from '@/shared/validation/common-schemas';

export const buyerAddressBodySchema = z.object({
  label: safeString({ min: 1, max: 100, label: 'Etiket' }).optional(),
  firstName: safeString({ min: 2, max: 100, label: 'Ad' }),
  lastName: safeString({ min: 2, max: 100, label: 'Soyad' }),
  phone: phoneSchema,
  country: safeString({ min: 2, max: 100, label: 'Ülke' }),
  city: safeString({ min: 2, max: 100, label: 'Şehir' }),
  address: safeString({ min: 5, max: 1000, label: 'Adres' }),
  isDefaultDelivery: z.boolean().optional(),
  isDefaultBilling: z.boolean().optional(),
});

export const buyerAddressUpdateSchema = buyerAddressBodySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Güncellenecek en az bir alan gönderilmeli' }
);

export type BuyerAddressBody = z.infer<typeof buyerAddressBodySchema>;
