import jwt from 'jsonwebtoken';
import { verifyPasswordResetToken } from '@/internal/auth/tokens/email-token';
import { invalidateAuthOtp, OtpError, verifyAuthOtp } from '@/internal/auth/otp/otp';
import { hashPassword } from '@/internal/common/security';
import { AuthError } from '@/internal/auth/errors';
import {
  findUserByEmail,
  findUserById,
  updateUserById,
} from '@/repositories/auth/user.repository';
import type { ResetPasswordInput } from '@/features/identity/reset-password/reset-password.schema';

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
    },
  });
  await invalidateAuthOtp(userId, 'password_reset');
};

const resetPasswordByToken = async (token: string, newPassword: string) => {
  let userId: string;

  try {
    userId = verifyPasswordResetToken(token);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthError(410, 'Sıfırlama bağlantısının süresi doldu');
    }

    throw new AuthError(400, 'Geçersiz sıfırlama tokeni');
  }

  await updateUserPassword(userId, newPassword);
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
