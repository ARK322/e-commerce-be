import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import { RevokedToken } from '../../db';

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

export const isTokenRevoked = async (token: string) => {
  const revoked = await RevokedToken.exists({ tokenHash: hashToken(token) });
  return Boolean(revoked);
};

export const revokeToken = async (token: string) => {
  const decoded = jwt.decode(token) as jwt.JwtPayload | null;

  if (!decoded?.exp) {
    return;
  }

  const expiresAt = new Date(decoded.exp * 1000);

  if (expiresAt.getTime() <= Date.now()) {
    return;
  }

  await RevokedToken.updateOne(
    { tokenHash: hashToken(token) },
    { tokenHash: hashToken(token), expiresAt },
    { upsert: true }
  );
};
