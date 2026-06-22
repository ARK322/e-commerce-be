import type { SellerApprovalStatus } from '@/integrations/mongo';
import { SELLER_SYSTEM_OWNER_ROLE_SLUG } from '@/integrations/mongo';
import type { SellerPermissionKey } from '@/domains/identity/application/access/seller/permission-keys';
import {
  ALL_SELLER_PERMISSIONS,
  BIREYSEL_SELLER_PERMISSIONS,
} from '@/domains/identity/application/access/seller/permission-keys';
import { ensureSellerMember } from '@/domains/identity/application/access/seller/system-roles';
import { findSellerMemberById } from '@/domains/identity/infrastructure/repositories/seller-member.repository';
import { findSellerByIdLean } from '@/domains/identity/infrastructure/repositories/seller.repository';
import { findSellerRoleByIdLean } from '@/domains/identity/infrastructure/repositories/seller-role.repository';

export type SellerAccessContext = {
  userId: string;
  companyId: string;
  companyName: string | null;
  sellerType: 'bireysel' | 'kurumsal' | null;
  approvalStatus: SellerApprovalStatus;
  roleId: string;
  roleSlug: string;
  roleName: string;
  permissions: ReadonlySet<SellerPermissionKey>;
  isOwner: boolean;
  teamManagementEnabled: boolean;
  member: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  };
};

type SellerLean = {
  _id: unknown;
  companyName?: string | null;
  sellerType?: 'bireysel' | 'kurumsal' | null;
  approvalStatus: SellerApprovalStatus;
  authorizedFirstName?: string | null;
  authorizedLastName?: string | null;
  authorizedPhone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
};

const buildBireyselSellerContext = (userId: string, seller: SellerLean): SellerAccessContext => ({
  userId,
  companyId: String(seller._id),
  companyName: seller.companyName ?? null,
  sellerType: 'bireysel',
  approvalStatus: seller.approvalStatus,
  roleId: '',
  roleSlug: 'owner',
  roleName: 'Owner',
  permissions: new Set(BIREYSEL_SELLER_PERMISSIONS),
  isOwner: true,
  teamManagementEnabled: false,
  member: {
    firstName: seller.authorizedFirstName ?? seller.firstName ?? null,
    lastName: seller.authorizedLastName ?? seller.lastName ?? null,
    phone: seller.authorizedPhone ?? seller.phone ?? null,
  },
});

const buildContextFromMember = async (
  userId: string,
  member: {
    _id: unknown;
    sellerId: string;
    roleId: string;
    isOwner?: boolean;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  }
): Promise<SellerAccessContext | null> => {
  const [seller, role] = await Promise.all([
    findSellerByIdLean(member.sellerId),
    findSellerRoleByIdLean(String(member.roleId)),
  ]);

  if (!seller || !role) {
    return null;
  }

  if (String(role.sellerId) !== String(member.sellerId)) {
    return null;
  }

  const isOwner = member.isOwner || role.slug === SELLER_SYSTEM_OWNER_ROLE_SLUG;

  return {
    userId,
    companyId: String(member.sellerId),
    companyName: seller.companyName ?? null,
    sellerType: (seller.sellerType as SellerAccessContext['sellerType']) ?? null,
    approvalStatus: seller.approvalStatus,
    roleId: String(role._id),
    roleSlug: role.slug,
    roleName: role.name,
    permissions: new Set(
      isOwner ? ALL_SELLER_PERMISSIONS : (role.permissions as SellerPermissionKey[])
    ),
    isOwner,
    teamManagementEnabled: seller.sellerType === 'kurumsal',
    member: {
      firstName: member.firstName ?? null,
      lastName: member.lastName ?? null,
      phone: member.phone ?? null,
    },
  };
};

export const getSellerContext = async (userId: string): Promise<SellerAccessContext | null> => {
  const member = await findSellerMemberById(userId);

  if (member) {
    return buildContextFromMember(userId, member);
  }

  const seller = await findSellerByIdLean(userId);

  if (!seller) {
    return null;
  }

  if (seller.sellerType === 'bireysel' || !seller.sellerType) {
    return buildBireyselSellerContext(userId, seller);
  }

  const ensuredMember = await ensureSellerMember(userId);

  if (!ensuredMember) {
    return null;
  }

  return buildContextFromMember(userId, ensuredMember);
};
