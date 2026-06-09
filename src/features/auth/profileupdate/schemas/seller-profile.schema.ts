import { z } from 'zod';

const phoneSchema = z.string().min(10, 'Telefon numarası geçersiz');

const vknSchema = z
  .string()
  .length(10, 'VKN 10 haneli olmalı')
  .regex(/^\d+$/, 'VKN sadece rakam içermeli');

const ibanSchema = z
  .string()
  .length(26, 'IBAN 26 karakter olmalı')
  .regex(/^TR\d{24}$/, 'Geçerli bir TR IBAN girilmeli');

const fileUrlSchema = z.string().url('Geçerli bir dosya URL\'si olmalı');

const optionalUrlSchema = z.string().url('Geçerli bir URL olmalı').optional();

const commonSellerFields = {
  companyName: z.string().min(2, 'Şirket adı en az 2 karakter olmalı'),
  taxNumber: vknSchema,
  taxOffice: z.string().min(2, 'Vergi dairesi zorunludur'),
  country: z.string().min(2, 'Ülke seçilmeli'),
  city: z.string().min(2, 'İl seçilmeli'),
  district: z.string().min(2, 'İlçe seçilmeli'),
  companyAddress: z.string().min(5, 'Şirket adresi en az 5 karakter olmalı'),
  taxCertificateUrl: fileUrlSchema,
  bankName: z.string().min(2, 'Banka adı zorunludur'),
  iban: ibanSchema,
  accountHolderName: z.string().min(2, 'Hesap sahibi adı zorunludur'),
  companyLogoUrl: fileUrlSchema,
  companyDescription: z
    .string()
    .min(10, 'Şirket tanıtım metni en az 10 karakter olmalı'),
  companyWebsite: optionalUrlSchema,
  socialMediaLinks: z.array(z.string().url('Geçerli bir sosyal medya URL\'si olmalı')).optional(),
};

const sellerBireyselSchema = z.object({
  sellerType: z.literal('bireysel'),
  firstName: z.string().min(2, 'Ad en az 2 karakter olmalı'),
  lastName: z.string().min(2, 'Soyad en az 2 karakter olmalı'),
  phone: phoneSchema,
  signatureCircularUrl: fileUrlSchema.optional(),
  ...commonSellerFields,
});

const sellerKurumsalSchema = z.object({
  sellerType: z.literal('kurumsal'),
  authorizedFirstName: z.string().min(2, 'Yetkili adı en az 2 karakter olmalı'),
  authorizedLastName: z.string().min(2, 'Yetkili soyadı en az 2 karakter olmalı'),
  authorizedPhone: phoneSchema,
  companyPhone: phoneSchema,
  companyType: z.enum(['ltd', 'as', 'diger'], {
    message: 'Şirket türü ltd, as veya diger olmalı',
  }),
  signatureCircularUrl: fileUrlSchema,
  ...commonSellerFields,
});

export const sellerProfileSchema = z.discriminatedUnion('sellerType', [
  sellerBireyselSchema,
  sellerKurumsalSchema,
]);

export type SellerProfileInput = z.infer<typeof sellerProfileSchema>;
