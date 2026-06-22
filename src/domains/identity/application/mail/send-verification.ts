import { createUserId } from '@/shared/ids';
import {
  signEmailVerificationToken,
} from '@/domains/identity/application/tokens/email-token';
import { createAuthOtp } from '@/domains/identity/application/otp/otp';
import { sendVerificationEmail } from '@/integrations/resend/send';
import { updateUserById } from '@/domains/identity/infrastructure/repositories/auth/user.repository';

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
