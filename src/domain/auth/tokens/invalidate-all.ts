import { updateUserById } from '@/repositories/auth/user.repository';

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
  await updateUserById(userId, { $set: { sessionsRevokedAt: new Date() } });
};
