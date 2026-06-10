import { signAuthToken } from '../../../lib/auth/auth-token';
import { comparePassword } from '../../../lib/common/password';
import { User } from '../../../db';
import { RegisterError } from '../register/register.errors';
import type { LoginInput } from './schemas/login.schema';

export const login = async (data: LoginInput) => {
  const user = await User.findOne({ email: data.email.toLowerCase() });

  if (!user) {
    throw new RegisterError(401, 'E-posta veya şifre hatalı');
  }

  const passwordValid = await comparePassword(data.password, user.password);

  if (!passwordValid) {
    throw new RegisterError(401, 'E-posta veya şifre hatalı');
  }

  if (user.role !== 'admin' && !user.isEmailVerified) {
    throw new RegisterError(
      403,
      'E-posta adresini doğrulamadan giriş yapamazsın'
    );
  }

  const token = signAuthToken(user._id.toString(), user.role, data.rememberMe);

  return { user, token };
};
