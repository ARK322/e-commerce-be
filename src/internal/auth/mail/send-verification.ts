import { signEmailVerificationToken } from '@/internal/auth/tokens/email-token';
import { createAuthOtp } from '@/internal/auth/otp/otp';
import { sendVerificationEmail } from '@/integrations/resend/send';

export const sendUserVerificationEmail = async (userId: string, email: string) => {
  const token = signEmailVerificationToken(userId);
  const code = await createAuthOtp(userId, 'email_verify');
  await sendVerificationEmail(email, token, code);
};
