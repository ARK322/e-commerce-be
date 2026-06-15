import { SellerMember } from '@/db/auth/models/seller-member.model';
import {
  SellerRole,
  SELLER_SYSTEM_OWNER_ROLE_SLUG,
} from '@/db/auth/models/seller-role.model';
import { Seller } from '@/db/auth/models/seller.model';
import { ALL_SELLER_PERMISSIONS } from '@/features/auth/seller/access/permission-keys';
import { createUserId } from '@/lib/common/user-id';

export const ensureSystemOwnerSellerRole = async (sellerId: string) => {
  let role = await SellerRole.findOne({
    sellerId,
    slug: SELLER_SYSTEM_OWNER_ROLE_SLUG,
  });

  if (!role) {
    role = await SellerRole.create({
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
    await role.save();
  }

  return role;
};

export const ensureSellerMember = async (userId: string) => {
  const existing = await SellerMember.findById(userId);

  if (existing) {
    return existing;
  }

  const seller = await Seller.findById(userId);

  if (!seller || seller.sellerType !== 'kurumsal') {
    return null;
  }

  const ownerRole = await ensureSystemOwnerSellerRole(String(seller._id));

  return SellerMember.create({
    _id: userId,
    sellerId: String(seller._id),
    roleId: String(ownerRole._id),
    isOwner: true,
  });
};

export const cleanupSellerTeam = async (sellerId: string) => {
  await Promise.all([
    SellerMember.deleteMany({ sellerId }),
    SellerRole.deleteMany({ sellerId }),
  ]);
};

export const bootstrapSellerTeam = async (sellerId: string, ownerUserId: string) => {
  const ownerRole = await ensureSystemOwnerSellerRole(sellerId);

  const existingMember = await SellerMember.findById(ownerUserId);

  if (existingMember) {
    return { ownerRole, member: existingMember };
  }

  const member = await SellerMember.create({
    _id: ownerUserId,
    sellerId,
    roleId: String(ownerRole._id),
    isOwner: true,
  });

  return { ownerRole, member };
};
