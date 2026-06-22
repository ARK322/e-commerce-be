import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import {
  revokedTokenExists,
  upsertRevokedToken,
} from '@/domains/identity/infrastructure/repositories/auth/revoked-token.repository';
import { recordTokenRevocation } from '@/domains/identity/application/tokens/revocation-registry';

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
  // Dağıtık katman: gateway'in edge'de okuyabilmesi için Redis'e de yaz.
  await recordTokenRevocation(token);
};
