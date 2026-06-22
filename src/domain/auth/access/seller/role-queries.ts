import { AuthError } from '@/domain/auth/errors';
import { countOwnerSellerMembersByCompanyId } from '@/repositories/sellers/seller-member.repository';
import {
  findSellerRoleByIdAndCompanyIdLean,
  findSellerRoleSlugByIdAndCompanyIdLean,
  findSellerRolesByIdsAndCompanyIdLean,
} from '@/repositories/sellers/seller-role.repository';
import { SELLER_SYSTEM_OWNER_ROLE_SLUG } from '@/infrastructure/mongo';

export const assertAssignableSellerRoleId = async (companyId: string, roleId: string) => {
  const role = await findSellerRoleByIdAndCompanyIdLean(companyId, roleId);

  if (!role) {
    throw new AuthError(404, 'Rol bulunamadı');
  }

  if (role.isSystem && role.slug === SELLER_SYSTEM_OWNER_ROLE_SLUG) {
    throw new AuthError(403, 'Owner rolü atanamaz');
  }

  return role;
};

export const countOwnerSellerMembers = async (companyId: string) =>
  countOwnerSellerMembersByCompanyId(companyId);

export const isOwnerSellerRoleId = async (companyId: string, roleId: string) => {
  const role = await findSellerRoleSlugByIdAndCompanyIdLean(companyId, roleId);

  return role?.slug === SELLER_SYSTEM_OWNER_ROLE_SLUG;
};

export type SellerRoleSummary = {
  roleId: string;
  name: string;
  slug: string;
};

export const getSellerRoleSummariesByIds = async (
  companyId: string,
  roleIds: string[]
): Promise<Map<string, SellerRoleSummary>> => {
  const uniqueIds = [...new Set(roleIds)];

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const roles = await findSellerRolesByIdsAndCompanyIdLean(companyId, uniqueIds);

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
