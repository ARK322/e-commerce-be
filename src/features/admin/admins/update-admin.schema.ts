import { z } from 'zod';
import { uuidSchema } from '@/shared/validation/common-schemas';

export const updateAdminSchema = z.object({
  roleId: uuidSchema,
});

export type UpdateAdminInput = z.infer<typeof updateAdminSchema>;
