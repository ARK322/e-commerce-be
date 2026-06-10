import { z } from 'zod';
import { optionalSafeString, phoneSchema, safeString } from '../../../../lib/common/validation/common-schemas';

const nationalIdSchema = safeString({
  min: 11,
  max: 11,
  label: 'TC kimlik numarası',
  pattern: /^\d+$/,
  patternMessage: 'TC kimlik numarası sadece rakam içermeli',
});

export const buyerProfileUpdateSchema = z
  .object({
    firstName: optionalSafeString({ min: 2, max: 100, label: 'Ad' }),
    lastName: optionalSafeString({ min: 2, max: 100, label: 'Soyad' }),
    phone: phoneSchema.optional(),
    country: optionalSafeString({ min: 2, max: 100, label: 'Ülke' }),
    city: optionalSafeString({ min: 2, max: 100, label: 'Şehir' }),
    nationalId: nationalIdSchema.optional(),
    deliveryAddress: optionalSafeString({ min: 5, max: 1000, label: 'Teslimat adresi' }),
    corporateAddress: optionalSafeString({ min: 5, max: 1000, label: 'Kurumsal adres' }),
    billingSameAsDelivery: z.boolean().optional(),
    billingAddress: optionalSafeString({ min: 5, max: 1000, label: 'Fatura adresi' }),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Güncellenecek en az bir alan gönderilmeli',
  });

export type BuyerProfileUpdateInput = z.infer<typeof buyerProfileUpdateSchema>;
