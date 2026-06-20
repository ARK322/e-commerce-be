import jwt from 'jsonwebtoken';
import { signAuthToken, type UserRole } from '@/internal/auth/tokens/access-token';
import { verifyEmailVerificationToken } from '@/internal/auth/tokens/email-token';
import { invalidateAuthOtp, OtpError, verifyAuthOtp } from '@/internal/auth/otp/otp';
import { deleteUnverifiedUser } from '@/internal/auth/register/unverified-user';
import { AuthError } from '@/internal/auth/errors';
import { buildAuthUserFields } from '@/internal/auth/responses/user.response';
import {
  findUserByEmail,
  findUserById,
  saveUserDocument,
} from '@/repositories/auth/user.repository';
import type { VerifyEmailInput } from '@/features/identity/verify-email/verify-email.schema';

const markEmailVerified = async (userId: string) => {
  const user = await findUserById(userId);

  if (!user) {
    throw new AuthError(404, 'Kullanıcı bulunamadı');
  }

  if (user.isEmailVerified) {
    throw new AuthError(409, 'E-posta zaten doğrulanmış');
  }

  if (user.verificationExpiresAt && user.verificationExpiresAt < new Date()) {
    await deleteUnverifiedUser(userId);
    throw new AuthError(410, 'Doğrulama süresi doldu, lütfen tekrar kayıt ol');
  }

  user.isEmailVerified = true;
  user.verificationExpiresAt = null;
  await saveUserDocument(user);
  await invalidateAuthOtp(userId, 'email_verify');

  return user;
};

const verifyEmailByToken = async (token: string) => {
  let userId: string;

  try {
    userId = verifyEmailVerificationToken(token);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthError(410, 'Doğrulama bağlantısının süresi doldu');
    }

    throw new AuthError(400, 'Geçersiz doğrulama tokeni');
  }

  return markEmailVerified(userId);
};

const verifyEmailByCode = async (email: string, code: string) => {
  const user = await findUserByEmail(email);

  if (!user) {
    throw new AuthError(400, 'Geçersiz doğrulama kodu veya e-posta');
  }

  if (user.isEmailVerified) {
    throw new AuthError(409, 'E-posta zaten doğrulanmış');
  }

  try {
    await verifyAuthOtp(user._id.toString(), 'email_verify', code);
  } catch (error) {
    if (error instanceof OtpError) {
      throw new AuthError(error.statusCode, error.message);
    }

    throw error;
  }

  return markEmailVerified(user._id.toString());
};

export const verifyEmail = async (input: VerifyEmailInput) => {
  const user =
    'token' in input
      ? await verifyEmailByToken(input.token)
      : await verifyEmailByCode(input.email, input.code);

  const token = signAuthToken(user._id.toString(), user.role as UserRole);
  const statusFields = await buildAuthUserFields(user);

  return {
    message: 'E-posta doğrulandı',
    ...statusFields,
    isEmailVerified: user.isEmailVerified,
    token,
  };
};
