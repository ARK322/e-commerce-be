import { revokeToken } from '@/domains/identity/application/tokens/revoke-token';
import { revokeAllSessions } from '@/domains/identity/application/tokens/invalidate-all';

export const logout = async (token: string) => {
  await revokeToken(token);
};

export const logoutAllSessions = async (userId: string) => {
  await revokeAllSessions(userId);
};
