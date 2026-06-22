import type { PermissionKey } from '@/domains/identity/application/access/admin/permission-keys';
import { SYSTEM_OWNER_ROLE_SLUG } from '@/integrations/mongo';
import { findAdminRoleIdByUserIdLean } from '@/domains/identity/infrastructure/repositories/auth/admin.repository';
import { findAdminRoleByIdLean } from '@/domains/identity/infrastructure/repositories/auth/admin-role.repository';

export type AdminAccessContext = {
  userId: string;
  roleId: string;
  roleSlug: string;
  roleName: string;
  permissions: ReadonlySet<PermissionKey>;
  isOwner: boolean;
};

export const getAdminContext = async (userId: string): Promise<AdminAccessContext | null> => {
  const admin = await findAdminRoleIdByUserIdLean(userId);

  if (!admin?.roleId) {
    return null;
  }

  const role = await findAdminRoleByIdLean(String(admin.roleId));

  if (!role) {
    return null;
  }

  const isOwner = role.slug === SYSTEM_OWNER_ROLE_SLUG;

  return {
    userId,
    roleId: String(role._id),
    roleSlug: role.slug,
    roleName: role.name,
    permissions: new Set(role.permissions as PermissionKey[]),
    isOwner,
  };
};
