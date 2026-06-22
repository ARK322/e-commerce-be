import { z } from 'zod';
import { safeString } from '@/shared/validation/common-schemas';
import { passwordSchema } from '@/domain/auth/schemas/password.schema';
import { emailSchema } from '@/domain/auth/schemas/email.schema';
import { otpCodeSchema } from '@/domain/auth/schemas/otp-code.schema';

export const resetPasswordByTokenSchema = z.object({
  token: safeString({ min: 1, max: 2048, label: 'Sıfırlama tokeni' }),
  newPassword: passwordSchema,
});

export const resetPasswordByCodeSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
  newPassword: passwordSchema,
});

export const resetPasswordSchema = z.union([
  resetPasswordByTokenSchema,
  resetPasswordByCodeSchema,
]);

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
