import { createLogger } from '@/shared/logging';
import {
  assertEmailCooldown,
  EmailCooldownError,
  markPasswordResetEmailSent,
} from '@/domain/auth/mail/cooldown';
import { signPasswordResetToken } from '@/domain/auth/tokens/email-token';
import { sendPasswordResetEmail } from '@/infrastructure/resend/send';
import { createAuthOtp, invalidateAuthOtp } from '@/domain/auth/otp/otp';
import { createUserId } from '@/shared/ids';
import { findUserByEmail, updateUserById } from '@/repositories/auth/user.repository';

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
