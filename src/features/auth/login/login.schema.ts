import { z } from 'zod';
import { emailSchema } from '@/domain/auth/schemas/email.schema';

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: 'Şifre zorunlu' })
    .min(1, 'Şifre zorunlu')
    .max(16, 'Şifre en fazla 16 karakter olabilir'),
  rememberMe: z.boolean().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;
