import { createLogger } from '@/shared/logging';
import {
  assertEmailCooldown,
  EmailCooldownError,
  markPasswordResetEmailSent,
} from '@/domains/identity/application/mail/cooldown';
import { signPasswordResetToken } from '@/domains/identity/application/tokens/email-token';
import { sendPasswordResetEmail } from '@/integrations/resend/send';
import { createAuthOtp, invalidateAuthOtp } from '@/domains/identity/application/otp/otp';
import { createUserId } from '@/shared/ids';
import { findUserByEmail, updateUserById } from '@/domains/identity/infrastructure/repositories/auth/user.repository';

const log = createLogger({ module: 'forgot-password' });

export const forgotPassword = async (email: string) => {
  const user = await findUserByEmail(email);

  if (!user) {
    return;
  }

  const userId = user._id.toString();

  try {
    assertEmailCooldown(user.passwordResetEmailSentAt);
  } catch (error) {
    if (error instanceof EmailCooldownError) {
      return;
    }

    throw error;
  }

  const jti = createUserId();
  const token = signPasswordResetToken(userId, jti);
  const code = await createAuthOtp(userId, 'password_reset');

  try {
    await sendPasswordResetEmail(user.email, token, code);
    await updateUserById(userId, {
      $set: { activePasswordResetJti: jti },
    });
    await markPasswordResetEmailSent(userId);
  } catch (error) {
    log.error({ err: error, userId, email: user.email }, 'Şifre sıfırlama e-postası gönderilemedi');
    await invalidateAuthOtp(userId, 'password_reset');
  }
};
