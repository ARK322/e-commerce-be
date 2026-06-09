import jwt from 'jsonwebtoken';

const AUTH_EXPIRES_IN = '1d';

export type AuthTokenPayload = {
  userId: string;
  role: 'buyer' | 'seller';
};

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET tanımlanmamış');
  }
  return secret;
};

export const signAuthToken = (userId: string, role: 'buyer' | 'seller'): string => {
  return jwt.sign({ purpose: 'access', role }, getSecret(), {
    subject: userId,
    expiresIn: AUTH_EXPIRES_IN,
  });
};

export const verifyAuthToken = (token: string): AuthTokenPayload => {
  const payload = jwt.verify(token, getSecret()) as jwt.JwtPayload;

  if (payload.purpose !== 'access' || !payload.sub || !payload.role) {
    throw new jwt.JsonWebTokenError('Geçersiz token');
  }

  if (payload.role !== 'buyer' && payload.role !== 'seller') {
    throw new jwt.JsonWebTokenError('Geçersiz token');
  }

  return {
    userId: payload.sub,
    role: payload.role,
  };
};
