import { z } from 'zod';
import { safeString } from '../../../../lib/common/validation/common-schemas';
import { passwordSchema } from '../../register/schemas/password.schema';

export const resetPasswordSchema = z.object({
  token: safeString({ min: 1, max: 2048, label: 'Sıfırlama tokeni' }),
  newPassword: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
