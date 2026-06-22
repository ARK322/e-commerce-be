import { createUserId } from '@/shared/ids';
import { signPasswordResetToken } from '@/domains/identity/application/tokens/email-token';
import { createAuthOtp } from '@/domains/identity/application/otp/otp';
import { sendPasswordResetEmail } from '@/integrations/resend/send';
import { updateUserById } from '@/domains/identity/infrastructure/repositories/auth/user.repository';

export const sendSellerMemberInviteEmail = async (userId: string, email: string) => {
  const jti = createUserId();
  const token = signPasswordResetToken(userId, jti);
  const code = await createAuthOtp(userId, 'password_reset');

  await sendPasswordResetEmail(email, token, code);
  await updateUserById(userId, {
    $set: { activePasswordResetJti: jti },
  });
};
