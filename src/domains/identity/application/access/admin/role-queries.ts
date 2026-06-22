import { SYSTEM_OWNER_ROLE_SLUG } from '@/integrations/mongo';
import { AuthError } from '@/domains/identity/application/errors';
import { countAdminsByRoleId } from '@/domains/identity/infrastructure/repositories/auth/admin.repository';
import {
  findAdminRoleByIdLean,
  findAdminRoleBySlugLean,
  findAdminRolesByIdsLean,
} from '@/domains/identity/infrastructure/repositories/auth/admin-role.repository';

export const assertAssignableRoleId = async (roleId: string) => {
  const role = await findAdminRoleByIdLean(roleId);

  if (!role) {
    throw new AuthError(404, 'Rol bulunamadı');
  }

  if (role.isSystem && role.slug === SYSTEM_OWNER_ROLE_SLUG) {
    throw new AuthError(403, 'Owner rolü atanamaz');
  }

  return role;
};

export const countOwnerAdmins = async () => {
  const ownerRole = await findAdminRoleBySlugLean(SYSTEM_OWNER_ROLE_SLUG);

  if (!ownerRole) {
    return 0;
  }

  return countAdminsByRoleId(String(ownerRole._id));
};

export const isOwnerRoleId = async (roleId: string) => {
  const role = await findAdminRoleByIdLean(roleId);
  return role?.slug === SYSTEM_OWNER_ROLE_SLUG;
};

export type RoleSummary = {
  roleId: string;
  name: string;
  slug: string;
};

export const getRoleSummariesByIds = async (roleIds: string[]): Promise<Map<string, RoleSummary>> => {
  const uniqueIds = [...new Set(roleIds)];

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const roles = await findAdminRolesByIdsLean(uniqueIds);

  return new Map(
    roles.map((role) => [
      String(role._id),
      {
        roleId: String(role._id),
        name: role.name,
        slug: role.slug,
      },
    ])
  );
};
