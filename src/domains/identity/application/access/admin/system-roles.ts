import { SYSTEM_OWNER_ROLE_SLUG } from '@/integrations/mongo';
import { ALL_PERMISSIONS } from '@/domains/identity/application/access/admin/permission-keys';
import { createUserId } from '@/shared/ids';
import {
  createAdminRole,
  findAdminRoleBySlug,
  saveAdminRoleDocument,
} from '@/domains/identity/infrastructure/repositories/auth/admin-role.repository';

export const ensureSystemOwnerRole = async () => {
  let role = await findAdminRoleBySlug(SYSTEM_OWNER_ROLE_SLUG);

  if (!role) {
    role = await createAdminRole({
      _id: createUserId(),
      name: 'Owner',
      slug: SYSTEM_OWNER_ROLE_SLUG,
      description: 'Sistem sahibi — tüm yetkiler',
      permissions: ALL_PERMISSIONS,
      isSystem: true,
      createdBy: null,
    });

    return role;
  }

  const missingPermissions = ALL_PERMISSIONS.filter(
    (permission) => !role!.permissions.includes(permission)
  );

  if (missingPermissions.length > 0) {
    role.permissions = ALL_PERMISSIONS;
    await saveAdminRoleDocument(role);
  }

  return role;
};
