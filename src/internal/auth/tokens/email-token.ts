import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { JWT_VERIFY_OPTIONS } from '@/internal/auth/tokens/jwt-options';

const EMAIL_VERIFY_EXPIRES_IN = '24h';
const PASSWORD_RESET_EXPIRES_IN = '1h';

const getSecret = () => env.jwtSecret;

export const signEmailVerificationToken = (userId: string): string => {
  return jwt.sign({ purpose: 'email_verify' }, getSecret(), {
    subject: userId,
    expiresIn: EMAIL_VERIFY_EXPIRES_IN,
    algorithm: 'HS256',
  });
};

export const verifyEmailVerificationToken = (token: string): string => {
  const payload = jwt.verify(token, getSecret(), JWT_VERIFY_OPTIONS) as jwt.JwtPayload;

  if (payload.purpose !== 'email_verify' || !payload.sub) {
    throw new jwt.JsonWebTokenError('Geçersiz doğrulama tokeni');
  }

  return payload.sub;
};

export const signPasswordResetToken = (userId: string): string => {
  return jwt.sign({ purpose: 'password_reset' }, getSecret(), {
    subject: userId,
    expiresIn: PASSWORD_RESET_EXPIRES_IN,
    algorithm: 'HS256',
  });
};

export const verifyPasswordResetToken = (token: string): string => {
  const payload = jwt.verify(token, getSecret(), JWT_VERIFY_OPTIONS) as jwt.JwtPayload;

  if (payload.purpose !== 'password_reset' || !payload.sub) {
    throw new jwt.JsonWebTokenError('Geçersiz sıfırlama tokeni');
  }

  return payload.sub;
};
