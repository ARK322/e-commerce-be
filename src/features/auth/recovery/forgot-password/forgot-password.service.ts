import { createLogger } from '@/internal/logging';
import {
  assertEmailCooldown,
  EmailCooldownError,
  markPasswordResetEmailSent,
} from '@/internal/auth/mail/cooldown';
import { signPasswordResetToken } from '@/internal/auth/tokens/email-token';
import { sendPasswordResetEmail } from '@/integrations/resend/send';
import { createAuthOtp, invalidateAuthOtp } from '@/internal/auth/otp/otp';
import { User } from '@/integrations/mongo';
import { AuthError } from '@/internal/auth/errors';

const log = createLogger({ module: 'forgot-password' });

export const forgotPassword = async (email: string) => {
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    return;
  }

  const userId = user._id.toString();

  try {
    assertEmailCooldown(user.passwordResetEmailSentAt);
  } catch (error) {
    if (error instanceof EmailCooldownError) {
      throw new AuthError(error.statusCode, error.message);
    }

    throw error;
  }

  const token = signPasswordResetToken(userId);
  const code = await createAuthOtp(userId, 'password_reset');

  try {
    await sendPasswordResetEmail(user.email, token, code);
    await markPasswordResetEmailSent(userId);
  } catch (error) {
    log.error({ err: error, userId, email: user.email }, 'Şifre sıfırlama e-postası gönderilemedi');
    await invalidateAuthOtp(userId, 'password_reset');
    throw new AuthError(
      503,
      'Şifre sıfırlama e-postası gönderilemedi, lütfen tekrar deneyin'
    );
  }
};
