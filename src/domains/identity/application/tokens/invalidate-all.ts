import { updateUserById } from '@/domains/identity/infrastructure/repositories/auth/user.repository';
import { recordUserRevocationCutoff } from '@/domains/identity/application/tokens/revocation-registry';

export const PASSWORD_CHANGED_MESSAGE = 'Şifre değiştirildi, tekrar giriş yapın';
export const SESSIONS_REVOKED_MESSAGE = 'Tüm oturumlar sonlandırıldı, tekrar giriş yapın';

export const isTokenIssuedBefore = (
  tokenIssuedAtSeconds: number | undefined,
  invalidationPoint: Date | null | undefined
) => {
  if (!invalidationPoint || tokenIssuedAtSeconds === undefined) {
    return false;
  }

  return tokenIssuedAtSeconds * 1000 < invalidationPoint.getTime();
};

export const revokeAllSessions = async (userId: string) => {
  const revokedAt = new Date();
  await updateUserById(userId, { $set: { sessionsRevokedAt: revokedAt } });
  // Dağıtık katman: bu andan önceki tüm token'lar gateway edge'de geçersiz olur.
  await recordUserRevocationCutoff(userId, revokedAt.getTime());
};
