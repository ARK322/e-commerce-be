import { z } from 'zod';
import { safeString } from '@/shared/validation/common-schemas';
import { emailSchema } from '@/domain/auth/schemas/email.schema';
import { otpCodeSchema } from '@/domain/auth/schemas/otp-code.schema';

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
