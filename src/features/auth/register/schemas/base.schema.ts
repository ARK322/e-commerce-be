import { z } from 'zod';
import { emailSchema } from './email.schema';
import { passwordSchema } from './password.schema';

export const baseSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    role: z.enum(['buyer', 'seller'], {
      message: 'Rol buyer veya seller olmalı',
    }),
  })
  .strict();

export type RegisterInput = z.infer<typeof baseSchema>;
