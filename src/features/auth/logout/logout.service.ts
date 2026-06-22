import { revokeToken } from '@/domain/auth/tokens/revoke-token';
import { revokeAllSessions } from '@/domain/auth/tokens/invalidate-all';

export const logout = async (token: string) => {
  await revokeToken(token);
};

export const logoutAllSessions = async (userId: string) => {
  await revokeAllSessions(userId);
};
