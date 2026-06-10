import { getAdminRole } from './admin-role';
import { getSellerApprovalStatus } from './seller-approval';
import type { AdminRole } from '../../db/auth/admin.model';
import type { SellerApprovalStatus } from '../../db/auth/seller.model';
import { RegisterError } from '../../features/auth/register/register.errors';

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
  approvalStatus: SellerApprovalStatus;
};

export type AdminAuthFields = {
  userId: unknown;
  role: string;
  isEmailVerified?: boolean;
  adminRole: AdminRole;
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
    return {
      ...base,
      approvalStatus: await getSellerApprovalStatus(String(user._id)),
    };
  }

  if (user.role === 'buyer') {
    return {
      ...base,
      isActive: user.isActive ?? false,
    };
  }

  const adminRole = await getAdminRole(String(user._id));

  if (!adminRole) {
    throw new RegisterError(403, 'Admin profili bulunamadı');
  }

  return {
    ...base,
    adminRole,
  };
};
