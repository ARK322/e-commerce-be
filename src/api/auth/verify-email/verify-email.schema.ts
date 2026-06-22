import { z } from 'zod';
import { safeString } from '@/shared/validation/common-schemas';
import { emailSchema } from '@/domains/identity/application/schemas/email.schema';
import { otpCodeSchema } from '@/domains/identity/application/schemas/otp-code.schema';

export const verifyEmailByTokenSchema = z.object({
  token: safeString({ min: 1, max: 2048, label: 'Doğrulama tokeni' }),
});

export const verifyEmailByCodeSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
});

export const verifyEmailSchema = z.union([
  verifyEmailByTokenSchema,
  verifyEmailByCodeSchema,
]);

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
