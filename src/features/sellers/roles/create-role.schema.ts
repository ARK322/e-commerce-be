import { z } from 'zod';
import {
  ASSIGNABLE_SELLER_PERMISSIONS,
  isSellerPermissionKey,
} from '@/domain/auth/access/seller/permission-keys';

const slugSchema = z
  .string()
  .trim()
  .min(2, 'Slug en az 2 karakter olmalı')
  .max(100, 'Slug en fazla 100 karakter olabilir')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug küçük harf, rakam ve tire içerebilir');

const permissionsSchema = z
  .array(z.string())
  .min(1, 'En az bir yetki seçilmeli')
  .superRefine((permissions, ctx) => {
    for (const permission of permissions) {
      if (!isSellerPermissionKey(permission)) {
        ctx.addIssue({
          code: 'custom',
          message: `Geçersiz yetki: ${permission}`,
        });
        return;
      }

      if (!ASSIGNABLE_SELLER_PERMISSIONS.includes(permission)) {
        ctx.addIssue({
          code: 'custom',
          message: `Bu yetki custom rollere atanamaz: ${permission}`,
        });
      }
    }
  })
  .transform((permissions) => [...new Set(permissions)]);

export const createSellerRoleSchema = z.object({
  name: z.string().trim().min(2, 'Rol adı en az 2 karakter olmalı').max(100),
  slug: slugSchema,
  description: z.string().trim().max(1000).optional(),
  permissions: permissionsSchema,
});

export type CreateSellerRoleInput = z.infer<typeof createSellerRoleSchema>;

export const updateSellerRoleSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    permissions: permissionsSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'En az bir alan güncellenmeli',
  });

export type UpdateSellerRoleInput = z.infer<typeof updateSellerRoleSchema>;
