import type { AuthTokenPayload } from '@/domain/auth/tokens/access-token';
import { buildAuthUserFields } from '@/domain/auth/responses/user.response';
import { AuthError } from '@/domain/auth/errors';
import { findUserById } from '@/repositories/auth/user.repository';

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
