import { z } from 'zod';
import { emailSchema } from '../../register/schemas/email.schema';

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: 'Şifre zorunlu' })
    .min(1, 'Şifre zorunlu')
    .max(128, 'Şifre çok uzun'),
  rememberMe: z.boolean().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;
