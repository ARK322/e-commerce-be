import { z } from 'zod';
import { adminProfileFieldsSchema } from '@/domains/identity/application/profile/admin-profile.schema';
import { emailSchema } from '@/domains/identity/application/schemas/email.schema';
import { passwordSchema } from '@/domains/identity/application/schemas/password.schema';
import { uuidSchema } from '@/shared/validation/common-schemas';

export const createAdminSchema = adminProfileFieldsSchema.extend({
  email: emailSchema,
  password: passwordSchema,
  roleId: uuidSchema,
});

export type CreateAdminInput = z.infer<typeof createAdminSchema>;
