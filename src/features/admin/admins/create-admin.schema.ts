import { z } from 'zod';
import { adminProfileFieldsSchema } from '@/domain/auth/profile/admin-profile.schema';
import { emailSchema } from '@/domain/auth/schemas/email.schema';
import { passwordSchema } from '@/domain/auth/schemas/password.schema';
import { uuidSchema } from '@/shared/validation/common-schemas';

export const createAdminSchema = adminProfileFieldsSchema.extend({
  email: emailSchema,
  password: passwordSchema,
  roleId: uuidSchema,
});

export type CreateAdminInput = z.infer<typeof createAdminSchema>;
