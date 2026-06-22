import { signAuthToken } from '@/domains/identity/application/tokens/access-token';
import { comparePassword } from '@/shared/security';
import { AuthError } from '@/domains/identity/application/errors';
import { buildAuthUserFields } from '@/domains/identity/application/responses/user.response';
import { LOGIN_LOCKOUT_MS, LOGIN_MAX_FAILED_ATTEMPTS } from '@/config/constants';
import {
  findUserByEmail,
  updateUserById,
} from '@/domains/identity/infrastructure/repositories/auth/user.repository';
import type { LoginInput } from '@/api/auth/login/login.schema';

const INVALID_CREDENTIALS_MESSAGE = 'E-posta veya şifre hatalı';

const recordFailedLogin = async (userId: string, currentAttempts: number) => {
  const nextAttempts = currentAttempts + 1;
  const update: Record<string, unknown> = {
    failedLoginAttempts: nextAttempts,
  };

  if (nextAttempts >= LOGIN_MAX_FAILED_ATTEMPTS) {
    update.loginBlockedUntil = new Date(Date.now() + LOGIN_LOCKOUT_MS);
  }

  await updateUserById(userId, { $set: update });
};

const resetLoginAttempts = async (userId: string) => {
  await updateUserById(userId, {
    $set: {
      failedLoginAttempts: 0,
      loginBlockedUntil: null,
    },
  });
};

export const login = async (data: LoginInput) => {
  const user = await findUserByEmail(data.email);

  if (!user) {
    throw new AuthError(401, INVALID_CREDENTIALS_MESSAGE);
  }

  if (user.loginBlockedUntil && user.loginBlockedUntil <= new Date()) {
    await resetLoginAttempts(user._id.toString());
    user.failedLoginAttempts = 0;
    user.loginBlockedUntil = null;
  }

  if (user.loginBlockedUntil && user.loginBlockedUntil > new Date()) {
    throw new AuthError(401, INVALID_CREDENTIALS_MESSAGE);
  }

  const passwordValid = await comparePassword(data.password, user.password);

  if (!passwordValid) {
    await recordFailedLogin(user._id.toString(), user.failedLoginAttempts ?? 0);
    throw new AuthError(401, INVALID_CREDENTIALS_MESSAGE);
  }

  if (user.role !== 'admin' && !user.isEmailVerified) {
    throw new AuthError(401, INVALID_CREDENTIALS_MESSAGE);
  }

  if ((user.role === 'admin' || user.role === 'seller') && user.isActive === false) {
    throw new AuthError(401, INVALID_CREDENTIALS_MESSAGE);
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
