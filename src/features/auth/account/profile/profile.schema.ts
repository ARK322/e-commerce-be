import { z } from 'zod';
import {
  optionalSafeString,
  optionalSafeUrlSchema,
  phoneSchema,
  safeString,
  safeUrlSchema,
} from '@/internal/validation/common-schemas';

const nationalIdSchema = safeString({
  min: 11,
  max: 11,
  label: 'TC kimlik numarası',
  pattern: /^\d+$/,
  patternMessage: 'TC kimlik numarası sadece rakam içermeli',
});

const vknSchema = safeString({
  min: 10,
  max: 10,
  label: 'VKN',
  pattern: /^\d+$/,
  patternMessage: 'VKN sadece rakam içermeli',
});

const ibanSchema = safeString({
  min: 26,
  max: 26,
  label: 'IBAN',
  pattern: /^TR\d{24}$/,
  patternMessage: 'Geçerli bir TR IBAN girilmeli',
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

export const sellerProfileUpdateSchema = z
  .object({
    sellerType: z.enum(['bireysel', 'kurumsal']).optional(),
    firstName: optionalSafeString({ min: 2, max: 100, label: 'Ad' }),
    lastName: optionalSafeString({ min: 2, max: 100, label: 'Soyad' }),
    phone: phoneSchema.optional(),
    authorizedFirstName: optionalSafeString({ min: 2, max: 100, label: 'Yetkili adı' }),
    authorizedLastName: optionalSafeString({ min: 2, max: 100, label: 'Yetkili soyadı' }),
    authorizedPhone: phoneSchema.optional(),
    companyPhone: phoneSchema.optional(),
    companyType: z.enum(['ltd', 'as']).optional(),
    companyName: optionalSafeString({ min: 2, max: 200, label: 'Şirket adı' }),
    taxNumber: vknSchema.optional(),
    taxOffice: optionalSafeString({ min: 2, max: 100, label: 'Vergi dairesi' }),
    country: optionalSafeString({ min: 2, max: 100, label: 'Ülke' }),
    city: optionalSafeString({ min: 2, max: 100, label: 'İl' }),
    district: optionalSafeString({ min: 2, max: 100, label: 'İlçe' }),
    companyAddress: optionalSafeString({ min: 5, max: 1000, label: 'Şirket adresi' }),
    taxCertificateUrl: safeUrlSchema.optional(),
    signatureCircularUrl: safeUrlSchema.optional(),
    bankName: optionalSafeString({ min: 2, max: 100, label: 'Banka adı' }),
    iban: ibanSchema.optional(),
    accountHolderName: optionalSafeString({ min: 2, max: 100, label: 'Hesap sahibi adı' }),
    companyLogoUrl: safeUrlSchema.optional(),
    companyDescription: optionalSafeString({
      min: 10,
      max: 2000,
      label: 'Şirket tanıtım metni',
    }),
    companyWebsite: optionalSafeUrlSchema,
    socialMediaLinks: z.array(safeUrlSchema).max(10, 'En fazla 10 sosyal medya linki').optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Güncellenecek en az bir alan gönderilmeli',
  });

export type BuyerProfileUpdateInput = z.infer<typeof buyerProfileUpdateSchema>;
export type SellerProfileUpdateInput = z.infer<typeof sellerProfileUpdateSchema>;
