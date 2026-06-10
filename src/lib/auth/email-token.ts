import jwt from 'jsonwebtoken';

const EMAIL_VERIFY_EXPIRES_IN = '24h';
const PASSWORD_RESET_EXPIRES_IN = '1h';

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET tanımlanmamış');
  }
  return secret;
};

export const signEmailVerificationToken = (userId: string): string => {
  return jwt.sign({ purpose: 'email_verify' }, getSecret(), {
    subject: userId,
    expiresIn: EMAIL_VERIFY_EXPIRES_IN,
  });
};

export const verifyEmailVerificationToken = (token: string): string => {
  const payload = jwt.verify(token, getSecret()) as jwt.JwtPayload;

  if (payload.purpose !== 'email_verify' || !payload.sub) {
    throw new jwt.JsonWebTokenError('Geçersiz doğrulama tokeni');
  }

  return payload.sub;
};

export const signPasswordResetToken = (userId: string): string => {
  return jwt.sign({ purpose: 'password_reset' }, getSecret(), {
    subject: userId,
    expiresIn: PASSWORD_RESET_EXPIRES_IN,
  });
};

export const verifyPasswordResetToken = (token: string): string => {
  const payload = jwt.verify(token, getSecret()) as jwt.JwtPayload;

  if (payload.purpose !== 'password_reset' || !payload.sub) {
    throw new jwt.JsonWebTokenError('Geçersiz sıfırlama tokeni');
  }

  return payload.sub;
};
