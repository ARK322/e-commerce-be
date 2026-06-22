import jwt from 'jsonwebtoken';
import { verifyPasswordResetToken } from '@/domain/auth/tokens/email-token';
import { invalidateAuthOtp, OtpError, verifyAuthOtp } from '@/domain/auth/otp/otp';
import { hashPassword } from '@/shared/security';
import { AuthError } from '@/domain/auth/errors';
import {
  findUserByEmail,
  findUserById,
  updateUserById,
} from '@/repositories/auth/user.repository';
import { revokeAllSessions } from '@/domain/auth/tokens/invalidate-all';
import { activateInvitedSellerAfterPasswordReset } from '@/domain/auth/members/activate-invited-seller';
import type { ResetPasswordInput } from '@/features/auth/reset-password/reset-password.schema';

const updateUserPassword = async (userId: string, newPassword: string) => {
  const user = await findUserById(userId);

  if (!user) {
    throw new AuthError(404, 'Kullanıcı bulunamadı');
  }

  const hashedPassword = await hashPassword(newPassword);
  await updateUserById(userId, {
    $set: {
      password: hashedPassword,
      passwordChangedAt: new Date(),
      activePasswordResetJti: null,
    },
  });
  await invalidateAuthOtp(userId, 'password_reset');
  await activateInvitedSellerAfterPasswordReset(userId);
  await revokeAllSessions(userId);
};

const resetPasswordByToken = async (token: string, newPassword: string) => {
  let verified: ReturnType<typeof verifyPasswordResetToken>;

  try {
    verified = verifyPasswordResetToken(token);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthError(410, 'Sıfırlama bağlantısının süresi doldu');
    }

    throw new AuthError(400, 'Geçersiz sıfırlama tokeni');
  }

  const user = await findUserById(verified.userId);

  if (!user) {
    throw new AuthError(404, 'Kullanıcı bulunamadı');
  }

  if (!user.activePasswordResetJti || user.activePasswordResetJti !== verified.jti) {
    throw new AuthError(400, 'Geçersiz sıfırlama tokeni');
  }

  await updateUserPassword(verified.userId, newPassword);
};

const resetPasswordByCode = async (email: string, code: string, newPassword: string) => {
  const user = await findUserByEmail(email);

  if (!user) {
    throw new AuthError(400, 'Geçersiz doğrulama kodu veya e-posta');
  }

  try {
    await verifyAuthOtp(user._id.toString(), 'password_reset', code);
  } catch (error) {
    if (error instanceof OtpError) {
      throw new AuthError(error.statusCode, error.message);
    }

    throw error;
  }

  await updateUserPassword(user._id.toString(), newPassword);
};

export const resetPassword = async (input: ResetPasswordInput) => {
  if ('token' in input) {
    await resetPasswordByToken(input.token, input.newPassword);
    return;
  }

  await resetPasswordByCode(input.email, input.code, input.newPassword);
};
