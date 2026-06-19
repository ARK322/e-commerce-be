import type { AuthTokenPayload } from '@/internal/auth/tokens/access-token';
import { buildAuthUserFields } from '@/internal/auth/responses/user.response';
import { User } from '@/integrations/mongo';
import { AuthError } from '@/internal/auth/errors';

export const getMe = async (auth: AuthTokenPayload) => {
  const user = await User.findById(auth.userId).select(
    'email role isActive isEmailVerified'
  );

  if (!user) {
    throw new AuthError(404, 'Kullanıcı bulunamadı');
  }

  const statusFields = await buildAuthUserFields(user);

  return {
    email: user.email,
    ...statusFields,
  };
};
