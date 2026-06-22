import { z } from 'zod';
import { emailSchema } from '@/domain/auth/schemas/email.schema';

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
