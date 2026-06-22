import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { JWT_VERIFY_OPTIONS } from '@/domains/identity/application/tokens/jwt-options';
import { createUserId } from '@/shared/ids';

const EMAIL_VERIFY_EXPIRES_IN = '24h';
const PASSWORD_RESET_EXPIRES_IN = '1h';

const getSecret = () => env.jwtSecret;

export type ConsumableEmailToken = {
  userId: string;
  jti: string;
};

export const signEmailVerificationToken = (userId: string, jti = createUserId()): string => {
  return jwt.sign({ purpose: 'email_verify', jti }, getSecret(), {
    subject: userId,
    expiresIn: EMAIL_VERIFY_EXPIRES_IN,
    algorithm: 'HS256',
  });
};

export const verifyEmailVerificationToken = (token: string): ConsumableEmailToken => {
  const payload = jwt.verify(token, getSecret(), JWT_VERIFY_OPTIONS) as jwt.JwtPayload;

  if (
    payload.purpose !== 'email_verify' ||
    !payload.sub ||
    typeof payload.jti !== 'string' ||
    payload.jti.length === 0
  ) {
    throw new jwt.JsonWebTokenError('Geçersiz doğrulama tokeni');
  }

  return { userId: payload.sub, jti: payload.jti };
};

export const signPasswordResetToken = (userId: string, jti = createUserId()): string => {
  return jwt.sign({ purpose: 'password_reset', jti }, getSecret(), {
    subject: userId,
    expiresIn: PASSWORD_RESET_EXPIRES_IN,
    algorithm: 'HS256',
  });
};

export const verifyPasswordResetToken = (token: string): ConsumableEmailToken => {
  const payload = jwt.verify(token, getSecret(), JWT_VERIFY_OPTIONS) as jwt.JwtPayload;

  if (
    payload.purpose !== 'password_reset' ||
    !payload.sub ||
    typeof payload.jti !== 'string' ||
    payload.jti.length === 0
  ) {
    throw new jwt.JsonWebTokenError('Geçersiz sıfırlama tokeni');
  }

  return { userId: payload.sub, jti: payload.jti };
};
