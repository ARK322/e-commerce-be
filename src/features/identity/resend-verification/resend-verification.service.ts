import { createLogger } from '@/internal/common/logging';
import {
  assertEmailCooldown,
  EmailCooldownError,
  markVerificationEmailSent,
} from '@/internal/auth/mail/cooldown';
import { sendUserVerificationEmail } from '@/internal/auth/mail/send-verification';
import { invalidateAuthOtp } from '@/internal/auth/otp/otp';
import { AuthError } from '@/internal/auth/errors';
import { findUserByEmail } from '@/repositories/auth/user.repository';

const log = createLogger({ module: 'resend-verification' });

export const resendVerificationEmail = async (email: string) => {
  const user = await findUserByEmail(email);

  if (!user || user.isEmailVerified) {
    return;
  }

  const userId = user._id.toString();

  try {
    assertEmailCooldown(user.verificationEmailSentAt);
  } catch (error) {
    if (error instanceof EmailCooldownError) {
      throw new AuthError(error.statusCode, error.message);
    }

    throw error;
  }

  try {
    await sendUserVerificationEmail(userId, user.email);
    await markVerificationEmailSent(userId);
  } catch (error) {
    log.error({ err: error, userId, email }, 'Doğrulama e-postası gönderilemedi');
    await invalidateAuthOtp(userId, 'email_verify');
    throw new AuthError(
      503,
      'Doğrulama e-postası gönderilemedi, lütfen tekrar deneyin'
    );
  }
};
