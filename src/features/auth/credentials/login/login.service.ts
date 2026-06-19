import { signAuthToken } from '@/internal/auth/tokens/access-token';
import { comparePassword } from '@/internal/security';
import { User } from '@/integrations/mongo';
import { AuthError } from '@/internal/auth/errors';
import type { LoginInput } from '@/features/auth/credentials/login/login.schema';

export const login = async (data: LoginInput) => {
  const user = await User.findOne({ email: data.email.toLowerCase() });

  if (!user) {
    throw new AuthError(401, 'E-posta veya şifre hatalı');
  }

  const passwordValid = await comparePassword(data.password, user.password);

  if (!passwordValid) {
    throw new AuthError(401, 'E-posta veya şifre hatalı');
  }

  if (user.role !== 'admin' && !user.isEmailVerified) {
    throw new AuthError(
      403,
      'E-posta adresini doğrulamadan giriş yapamazsın'
    );
  }

  const token = signAuthToken(user._id.toString(), user.role, data.rememberMe);

  return { user, token };
};
