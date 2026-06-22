import { createUserId } from '@/shared/ids';
import {
  signEmailVerificationToken,
} from '@/domain/auth/tokens/email-token';
import { createAuthOtp } from '@/domain/auth/otp/otp';
import { sendVerificationEmail } from '@/infrastructure/resend/send';
import { updateUserById } from '@/repositories/auth/user.repository';

export const sendUserVerificationEmail = async (userId: string, email: string) => {
  const jti = createUserId();
  const token = signEmailVerificationToken(userId, jti);
  const code = await createAuthOtp(userId, 'email_verify');

  await sendVerificationEmail(email, token, code);

  await updateUserById(userId, {
    $set: { activeEmailVerifyJti: jti },
  });

  return jti;
};
