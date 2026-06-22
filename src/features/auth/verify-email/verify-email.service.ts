import jwt from 'jsonwebtoken';
import { signAuthToken, type UserRole } from '@/domain/auth/tokens/access-token';
import { verifyEmailVerificationToken } from '@/domain/auth/tokens/email-token';
import { invalidateAuthOtp, OtpError, verifyAuthOtp } from '@/domain/auth/otp/otp';
import { deleteUnverifiedUser } from '@/domain/auth/register/unverified-user';
import { AuthError } from '@/domain/auth/errors';
import { buildAuthUserFields } from '@/domain/auth/responses/user.response';
import {
  findUserByEmail,
  findUserById,
  saveUserDocument,
  updateUserById,
} from '@/repositories/auth/user.repository';
import type { VerifyEmailInput } from '@/features/auth/verify-email/verify-email.schema';

const markEmailVerified = async (userId: string) => {
  const user = await findUserById(userId);

  if (!user) {
    throw new AuthError(404, 'Kullanıcı bulunamadı');
  }

  if (user.isEmailVerified) {
    return user;
  }

  if (user.verificationExpiresAt && user.verificationExpiresAt < new Date()) {
    await deleteUnverifiedUser(userId);
    throw new AuthError(410, 'Doğrulama süresi doldu, lütfen tekrar kayıt ol');
  }

  user.isEmailVerified = true;
  user.verificationExpiresAt = null;
  user.activeEmailVerifyJti = null;
  if (user.role === 'seller') {
    user.isActive = true;
  }
  await saveUserDocument(user);
  await invalidateAuthOtp(userId, 'email_verify');

  return user;
};

const verifyEmailByToken = async (token: string) => {
  let verified: ReturnType<typeof verifyEmailVerificationToken>;

  try {
    verified = verifyEmailVerificationToken(token);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthError(410, 'Doğrulama bağlantısının süresi doldu');
    }

    throw new AuthError(400, 'Geçersiz doğrulama tokeni');
  }

  const user = await findUserById(verified.userId);

  if (!user) {
    throw new AuthError(404, 'Kullanıcı bulunamadı');
  }

  if (user.isEmailVerified) {
    throw new AuthError(400, 'E-posta zaten doğrulanmış, giriş yapın');
  }

  if (user.verificationExpiresAt && user.verificationExpiresAt < new Date()) {
    await deleteUnverifiedUser(verified.userId);
    throw new AuthError(410, 'Doğrulama süresi doldu, lütfen tekrar kayıt ol');
  }

  if (!user.activeEmailVerifyJti || user.activeEmailVerifyJti !== verified.jti) {
    throw new AuthError(400, 'Geçersiz doğrulama tokeni');
  }

  await updateUserById(verified.userId, {
    $set: {
      isEmailVerified: true,
      verificationExpiresAt: null,
      activeEmailVerifyJti: null,
      ...(user.role === 'seller' ? { isActive: true } : {}),
    },
  });
  await invalidateAuthOtp(verified.userId, 'email_verify');

  const refreshed = await findUserById(verified.userId);

  if (!refreshed) {
    throw new AuthError(404, 'Kullanıcı bulunamadı');
  }

  return refreshed;
};

const verifyEmailByCode = async (email: string, code: string) => {
  const user = await findUserByEmail(email);

  if (!user) {
    throw new AuthError(400, 'Geçersiz doğrulama kodu veya e-posta');
  }

  if (user.isEmailVerified) {
    throw new AuthError(400, 'E-posta zaten doğrulanmış, giriş yapın');
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
