import { z } from 'zod';
import { emailSchema, passwordSchema } from '@/domain/auth/schemas';

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    role: z.enum(['buyer', 'seller'], {
      message: 'Rol buyer veya seller olmalı',
    }),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
