import { createUserId } from '@/shared/ids';
import { signPasswordResetToken } from '@/domain/auth/tokens/email-token';
import { createAuthOtp } from '@/domain/auth/otp/otp';
import { sendPasswordResetEmail } from '@/infrastructure/resend/send';
import { updateUserById } from '@/repositories/auth/user.repository';

export const sendSellerMemberInviteEmail = async (userId: string, email: string) => {
  const jti = createUserId();
  const token = signPasswordResetToken(userId, jti);
  const code = await createAuthOtp(userId, 'password_reset');

  await sendPasswordResetEmail(email, token, code);
  await updateUserById(userId, {
    $set: { activePasswordResetJti: jti },
  });
};
