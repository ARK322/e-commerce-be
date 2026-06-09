import { z } from 'zod';

export const buyerProfileSchema = z
  .object({
    firstName: z.string().min(2, 'Ad en az 2 karakter olmalı'),
    lastName: z.string().min(2, 'Soyad en az 2 karakter olmalı'),
    phone: z.string().min(10, 'Telefon numarası geçersiz'),
    country: z.string().min(2, 'Ülke seçilmeli'),
    city: z.string().min(2, 'Şehir seçilmeli'),
    nationalId: z
      .string()
      .length(11, 'TC kimlik numarası 11 haneli olmalı')
      .regex(/^\d+$/, 'TC kimlik numarası sadece rakam içermeli'),
    deliveryAddress: z.string().min(5, 'Teslimat adresi en az 5 karakter olmalı'),
    corporateAddress: z
      .string()
      .min(5, 'Kurumsal adres en az 5 karakter olmalı')
      .optional(),
    billingSameAsDelivery: z.boolean(),
    billingAddress: z
      .string()
      .min(5, 'Fatura adresi en az 5 karakter olmalı')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.billingSameAsDelivery && !data.billingAddress) {
      ctx.addIssue({
        code: 'custom',
        message: 'Fatura adresi teslimat ile aynı değilse fatura adresi zorunludur',
        path: ['billingAddress'],
      });
    }
  });

export type BuyerProfileInput = z.infer<typeof buyerProfileSchema>;
