import type { AuthTokenPayload } from '@/domains/identity/application/tokens/access-token';
import { buildAuthUserFields } from '@/domains/identity/application/responses/user.response';
import { AuthError } from '@/domains/identity/application/errors';
import { findUserById } from '@/domains/identity/infrastructure/repositories/auth/user.repository';

export const getMe = async (auth: AuthTokenPayload) => {
  const user = await findUserById(auth.userId);

  if (!user) {
    throw new AuthError(404, 'Kullanıcı bulunamadı');
  }

  const statusFields = await buildAuthUserFields(user);

  return {
    email: user.email,
    ...statusFields,
  };
};
