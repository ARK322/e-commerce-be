import { createLogger } from '@/shared/logging';
import {
  assertEmailCooldown,
  EmailCooldownError,
  markVerificationEmailSent,
} from '@/domains/identity/application/mail/cooldown';
import { sendUserVerificationEmail } from '@/domains/identity/application/mail/send-verification';
import { invalidateAuthOtp } from '@/domains/identity/application/otp/otp';
import { findUserByEmail } from '@/domains/identity/infrastructure/repositories/auth/user.repository';

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
      return;
    }

    throw error;
  }

  try {
    await sendUserVerificationEmail(userId, user.email);
    await markVerificationEmailSent(userId);
  } catch (error) {
    log.error({ err: error, userId, email }, 'Doğrulama e-postası gönderilemedi');
    await invalidateAuthOtp(userId, 'email_verify');
  }
};
