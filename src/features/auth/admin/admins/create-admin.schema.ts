import { z } from 'zod';
import { adminProfileFieldsSchema } from '@/features/auth/admin/profile/profile.schema';
import { emailSchema } from '@/internal/auth/schemas/email.schema';
import { passwordSchema } from '@/internal/auth/schemas/password.schema';
import { uuidSchema } from '@/internal/validation/common-schemas';

export const createAdminSchema = adminProfileFieldsSchema.extend({
  email: emailSchema,
  password: passwordSchema,
  roleId: uuidSchema,
});

export type CreateAdminInput = z.infer<typeof createAdminSchema>;
