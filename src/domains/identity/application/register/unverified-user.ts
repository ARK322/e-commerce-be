import { deleteAuthOtpsForUser } from '@/domains/identity/application/otp/otp';
import { deleteBuyerById } from '@/domains/identity/infrastructure/repositories/buyer.repository';
import { deleteSellerMemberById } from '@/domains/identity/infrastructure/repositories/seller-member.repository';
import { deleteSellerRolesBySellerId } from '@/domains/identity/infrastructure/repositories/seller-role.repository';
import { deleteSellerById } from '@/domains/identity/infrastructure/repositories/seller.repository';
import { deleteUserById, findUserById } from '@/domains/identity/infrastructure/repositories/auth/user.repository';

export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export const getVerificationExpiresAt = () => new Date(Date.now() + VERIFICATION_TTL_MS);

export const deleteUnverifiedUser = async (userId: string) => {
  const user = await findUserById(userId);

  if (!user || user.isEmailVerified) {
    return;
  }

  await Promise.all([
    deleteAuthOtpsForUser(userId),
    deleteBuyerById(userId),
    deleteSellerMemberById(userId),
    deleteSellerRolesBySellerId(userId),
    deleteSellerById(userId),
  ]);
  await deleteUserById(userId);
};
