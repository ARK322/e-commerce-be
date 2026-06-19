import { User } from '@/integrations/mongo';

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
  await User.findByIdAndUpdate(userId, { sessionsRevokedAt: new Date() });
};
