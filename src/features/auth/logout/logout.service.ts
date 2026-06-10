import { revokeToken } from '../../../lib/auth/revoked-token';

export const logout = async (token: string) => {
  await revokeToken(token);
};
