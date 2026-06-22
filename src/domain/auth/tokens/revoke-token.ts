import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import {
  revokedTokenExists,
  upsertRevokedToken,
} from '@/repositories/auth/revoked-token.repository';

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

export const isTokenRevoked = async (token: string) => {
  const tokenHash = hashToken(token);
  const revoked = await revokedTokenExists(tokenHash);
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

  const tokenHash = hashToken(token);

  await upsertRevokedToken(tokenHash, expiresAt);
};
