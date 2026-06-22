import { SELLER_SYSTEM_OWNER_ROLE_SLUG } from '@/integrations/mongo';
import { ALL_SELLER_PERMISSIONS } from '@/domains/identity/application/access/seller/permission-keys';
import { createUserId } from '@/shared/ids';
import {
  createSellerMember,
  deleteSellerMembersBySellerId,
  findSellerMemberById,
} from '@/domains/identity/infrastructure/repositories/seller-member.repository';
import {
  createSellerRole,
  deleteSellerRolesBySellerId,
  findSellerRoleBySlugAndCompanyId,
  saveSellerRoleDocument,
} from '@/domains/identity/infrastructure/repositories/seller-role.repository';
import { findSellerById } from '@/domains/identity/infrastructure/repositories/seller.repository';

export const ensureSystemOwnerSellerRole = async (sellerId: string) => {
  let role = await findSellerRoleBySlugAndCompanyId(sellerId, SELLER_SYSTEM_OWNER_ROLE_SLUG);

  if (!role) {
    role = await createSellerRole({
      _id: createUserId(),
      sellerId,
      name: 'Owner',
      slug: SELLER_SYSTEM_OWNER_ROLE_SLUG,
      description: 'Şirket sahibi — tüm yetkiler',
      permissions: ALL_SELLER_PERMISSIONS,
      isSystem: true,
      createdBy: null,
    });

    return role;
  }

  const missingPermissions = ALL_SELLER_PERMISSIONS.filter(
    (permission) => !role!.permissions.includes(permission)
  );

  if (missingPermissions.length > 0) {
    role.permissions = ALL_SELLER_PERMISSIONS;
    await saveSellerRoleDocument(role);
  }

  return role;
};

export const ensureSellerMember = async (userId: string) => {
  const existing = await findSellerMemberById(userId);

  if (existing) {
    return existing;
  }

  const seller = await findSellerById(userId);

  if (!seller || seller.sellerType !== 'kurumsal') {
    return null;
  }

  const ownerRole = await ensureSystemOwnerSellerRole(String(seller._id));

  return createSellerMember({
    _id: userId,
    sellerId: String(seller._id),
    roleId: String(ownerRole._id),
    isOwner: true,
  });
};

export const cleanupSellerTeam = async (sellerId: string) => {
  await Promise.all([
    deleteSellerMembersBySellerId(sellerId),
    deleteSellerRolesBySellerId(sellerId),
  ]);
};

export const bootstrapSellerTeam = async (sellerId: string, ownerUserId: string) => {
  const ownerRole = await ensureSystemOwnerSellerRole(sellerId);

  const existingMember = await findSellerMemberById(ownerUserId);

  if (existingMember) {
    return { ownerRole, member: existingMember };
  }

  const member = await createSellerMember({
    _id: ownerUserId,
    sellerId,
    roleId: String(ownerRole._id),
    isOwner: true,
  });

  return { ownerRole, member };
};
