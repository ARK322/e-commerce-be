import { z } from 'zod';
import { safeString } from '../../../../lib/common/validation/common-schemas';

export const verifyEmailSchema = z.object({
  token: safeString({ min: 1, max: 2048, label: 'Doğrulama tokeni' }),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
