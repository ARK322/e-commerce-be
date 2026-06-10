import type { AuthTokenPayload } from '../../../lib/auth/auth-token';
import { buildAuthUserFields } from '../../../lib/auth/auth-user-response';
import { User } from '../../../db';
import { RegisterError } from '../register/register.errors';

export const getMe = async (auth: AuthTokenPayload) => {
  const user = await User.findById(auth.userId).select(
    'email role isActive isEmailVerified'
  );

  if (!user) {
    throw new RegisterError(404, 'Kullanıcı bulunamadı');
  }

  const statusFields = await buildAuthUserFields(user);

  return {
    email: user.email,
    ...statusFields,
  };
};
