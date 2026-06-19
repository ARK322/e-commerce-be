import { z } from 'zod';
import { optionalSafeString, phoneSchema } from '@/internal/validation/common-schemas';

export const adminProfileFieldsSchema = z.object({
  firstName: optionalSafeString({ min: 2, max: 100, label: 'Ad' }),
  lastName: optionalSafeString({ min: 2, max: 100, label: 'Soyad' }),
  phone: phoneSchema.optional(),
});

export const adminProfileUpdateSchema = adminProfileFieldsSchema
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Güncellenecek en az bir alan gönderilmeli',
  });

export type AdminProfileFields = z.infer<typeof adminProfileFieldsSchema>;
export type AdminProfileUpdateInput = z.infer<typeof adminProfileUpdateSchema>;
