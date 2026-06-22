import { deleteAuthOtpsForUser } from '@/domain/auth/otp/otp';
import { deleteBuyerById } from '@/repositories/buyers/buyer.repository';
import { deleteSellerMemberById } from '@/repositories/sellers/seller-member.repository';
import { deleteSellerRolesBySellerId } from '@/repositories/sellers/seller-role.repository';
import { deleteSellerById } from '@/repositories/sellers/seller.repository';
import { deleteUserById, findUserById } from '@/repositories/auth/user.repository';

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
