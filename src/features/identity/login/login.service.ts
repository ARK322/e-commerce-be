import { signAuthToken } from '@/internal/auth/tokens/access-token';
import { comparePassword } from '@/internal/common/security';
import { User } from '@/integrations/mongo';
import { AuthError } from '@/internal/auth/errors';
import { buildAuthUserFields } from '@/internal/auth/responses/user.response';
import { LOGIN_LOCKOUT_MS, LOGIN_MAX_FAILED_ATTEMPTS } from '@/config/constants';
import type { LoginInput } from '@/features/identity/login/login.schema';

const LOCKOUT_MESSAGE =
  'Çok fazla başarısız giriş denemesi. Lütfen bir süre sonra tekrar deneyin.';

const recordFailedLogin = async (userId: string, currentAttempts: number) => {
  const nextAttempts = currentAttempts + 1;
  const update: Record<string, unknown> = {
    failedLoginAttempts: nextAttempts,
  };

  if (nextAttempts >= LOGIN_MAX_FAILED_ATTEMPTS) {
    update.loginBlockedUntil = new Date(Date.now() + LOGIN_LOCKOUT_MS);
  }

  await User.findByIdAndUpdate(userId, { $set: update });
};

const resetLoginAttempts = async (userId: string) => {
  await User.findByIdAndUpdate(userId, {
    $set: {
      failedLoginAttempts: 0,
      loginBlockedUntil: null,
    },
  });
};

export const login = async (data: LoginInput) => {
  const user = await User.findOne({ email: data.email.toLowerCase() });

  if (!user) {
    throw new AuthError(401, 'E-posta veya şifre hatalı');
  }

  if (user.loginBlockedUntil && user.loginBlockedUntil > new Date()) {
    throw new AuthError(429, LOCKOUT_MESSAGE);
  }

  const passwordValid = await comparePassword(data.password, user.password);

  if (!passwordValid) {
    await recordFailedLogin(user._id.toString(), user.failedLoginAttempts ?? 0);
    throw new AuthError(401, 'E-posta veya şifre hatalı');
  }

  if (user.role !== 'admin' && !user.isEmailVerified) {
    throw new AuthError(
      403,
      'E-posta adresini doğrulamadan giriş yapamazsın'
    );
  }

  await resetLoginAttempts(user._id.toString());

  const token = signAuthToken(user._id.toString(), user.role, data.rememberMe);
  const statusFields = await buildAuthUserFields(user);

  return {
    message: 'Giriş başarılı',
    ...statusFields,
    token,
  };
};
