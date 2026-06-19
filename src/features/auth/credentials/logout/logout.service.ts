import { revokeToken } from '@/internal/auth/tokens/revoke-token';
import { revokeAllSessions } from '@/internal/auth/tokens/invalidate-all';

export const logout = async (token: string) => {
  await revokeToken(token);
};

export const logoutAllSessions = async (userId: string) => {
  await revokeAllSessions(userId);
};
