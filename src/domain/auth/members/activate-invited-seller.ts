import { findSellerMemberByIdLean } from '@/repositories/sellers/seller-member.repository';
import { findUserById, updateUserById } from '@/repositories/auth/user.repository';

export const activateInvitedSellerAfterPasswordReset = async (userId: string): Promise<void> => {
  const user = await findUserById(userId);

  if (!user || user.role !== 'seller') {
    return;
  }

  const member = await findSellerMemberByIdLean(userId);

  if (!member || member.isOwner) {
    return;
  }

  if (user.isEmailVerified && user.isActive) {
    return;
  }

  await updateUserById(userId, {
    $set: {
      isEmailVerified: true,
      isActive: true,
    },
  });
};
