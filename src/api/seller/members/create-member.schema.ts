import { z } from 'zod';
import { emailSchema } from '@/domains/identity/application/schemas/email.schema';
import { uuidSchema } from '@/shared/validation/common-schemas';

const memberProfileFieldsSchema = z.object({
  firstName: z.string().trim().min(1).max(500).optional(),
  lastName: z.string().trim().min(1).max(500).optional(),
  phone: z.string().trim().min(1).max(20).optional(),
});

export const createSellerMemberSchema = memberProfileFieldsSchema.extend({
  email: emailSchema,
  roleId: uuidSchema,
});

export type CreateSellerMemberInput = z.infer<typeof createSellerMemberSchema>;

export const updateSellerMemberRoleSchema = z.object({
  roleId: uuidSchema,
});

export type UpdateSellerMemberRoleInput = z.infer<typeof updateSellerMemberRoleSchema>;

export const updateSellerMemberProfileSchema = memberProfileFieldsSchema
  .refine((data) => Object.keys(data).length > 0, {
    message: 'En az bir alan güncellenmeli',
  });

export type UpdateSellerMemberProfileInput = z.infer<typeof updateSellerMemberProfileSchema>;
