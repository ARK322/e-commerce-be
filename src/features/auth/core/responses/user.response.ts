import { getAdminContext } from '@/features/auth/core/queries/admin-context';
import { getSellerContext } from '@/features/auth/core/queries/seller-context';
import { Seller } from '@/db';
import type { PermissionKey } from '@/features/auth/admin/access/permission-keys';
import type { SellerPermissionKey } from '@/features/auth/seller/access/permission-keys';
import { AuthError } from '@/features/auth/core/errors';

type AuthUserLike = {
  _id: unknown;
  role: string;
  isActive?: boolean;
  isEmailVerified?: boolean;
};

export type BuyerAuthFields = {
  userId: unknown;
  role: string;
  isEmailVerified?: boolean;
  isActive: boolean;
};

export type SellerAuthFields = {
  userId: unknown;
  role: string;
  isEmailVerified?: boolean;
  companyId: string;
  companyName: string | null;
  sellerType: 'bireysel' | 'kurumsal' | null;
  approvalStatus: string;
  teamManagementEnabled: boolean;
  roleId: string;
  roleSlug: string;
  roleName: string;
  permissions: SellerPermissionKey[];
  isOwner: boolean;
  member: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  };
};

export type AdminAuthFields = {
  userId: unknown;
  role: string;
  isEmailVerified?: boolean;
  roleId: string;
  roleSlug: string;
  roleName: string;
  permissions: PermissionKey[];
  isOwner: boolean;
};

export const buildAuthUserFields = async (
  user: AuthUserLike
): Promise<BuyerAuthFields | SellerAuthFields | AdminAuthFields> => {
  const base = {
    userId: user._id,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
  };

  if (user.role === 'seller') {
    const sellerContext = await getSellerContext(String(user._id));

    if (!sellerContext) {
      const legacySeller = await Seller.findById(String(user._id)).select('approvalStatus').lean();

      return {
        ...base,
        companyId: String(user._id),
        companyName: null,
        sellerType: null,
        approvalStatus: legacySeller?.approvalStatus ?? 'draft',
        teamManagementEnabled: false,
        roleId: '',
        roleSlug: '',
        roleName: '',
        permissions: [],
        isOwner: true,
        member: {
          firstName: null,
          lastName: null,
          phone: null,
        },
      };
    }

    return {
      ...base,
      companyId: sellerContext.companyId,
      companyName: sellerContext.companyName,
      sellerType: sellerContext.sellerType,
      approvalStatus: sellerContext.approvalStatus,
      teamManagementEnabled: sellerContext.teamManagementEnabled,
      roleId: sellerContext.roleId,
      roleSlug: sellerContext.roleSlug,
      roleName: sellerContext.roleName,
      permissions: [...sellerContext.permissions],
      isOwner: sellerContext.isOwner,
      member: sellerContext.member,
    };
  }

  if (user.role === 'buyer') {
    return {
      ...base,
      isActive: user.isActive ?? false,
    };
  }

  const adminContext = await getAdminContext(String(user._id));

  if (!adminContext) {
    throw new AuthError(403, 'Admin profili bulunamadı');
  }

  return {
    ...base,
    roleId: adminContext.roleId,
    roleSlug: adminContext.roleSlug,
    roleName: adminContext.roleName,
    permissions: [...adminContext.permissions],
    isOwner: adminContext.isOwner,
  };
};
