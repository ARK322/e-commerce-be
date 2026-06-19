import jwt from 'jsonwebtoken';
import { env } from '@/config/env';

const TOKEN_EXPIRES = {
  default: '1d',
  rememberMe: '30d',
} as const;

export type UserRole = 'buyer' | 'seller' | 'admin';

export type AuthTokenPayload = {
  userId: string;
  role: UserRole;
};

const getSecret = () => env.jwtSecret;

export const signAuthToken = (
  userId: string,
  role: UserRole,
  rememberMe = false
): string => {
  const expiresIn = rememberMe ? TOKEN_EXPIRES.rememberMe : TOKEN_EXPIRES.default;

  return jwt.sign({ purpose: 'access', role }, getSecret(), {
    subject: userId,
    expiresIn,
  });
};

export const verifyAuthToken = (token: string): AuthTokenPayload => {
  const payload = jwt.verify(token, getSecret()) as jwt.JwtPayload;

  if (payload.purpose !== 'access' || !payload.sub || !payload.role) {
    throw new jwt.JsonWebTokenError('Geçersiz token');
  }

  if (
    payload.role !== 'buyer' &&
    payload.role !== 'seller' &&
    payload.role !== 'admin'
  ) {
    throw new jwt.JsonWebTokenError('Geçersiz token');
  }

  return {
    userId: payload.sub,
    role: payload.role as UserRole,
  };
};
