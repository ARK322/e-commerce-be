import type { AuthTokenPayload } from '@/domains/identity/application/tokens/access-token';
import { hashPassword, comparePassword } from '@/shared/security';
import { AuthError } from '@/domains/identity/application/errors';
import {
  findUserById,
  updateUserById,
} from '@/domains/identity/infrastructure/repositories/auth/user.repository';
import { revokeAllSessions } from '@/domains/identity/application/tokens/invalidate-all';
import type { ChangePasswordInput } from '@/api/auth/change-password/change-password.schema';

export const changePassword = async (
  auth: AuthTokenPayload,
  data: ChangePasswordInput
) => {
  const user = await findUserById(auth.userId);

  if (!user) {
    throw new AuthError(404, 'Kullanıcı bulunamadı');
  }

  const currentValid = await comparePassword(data.currentPassword, user.password);

  if (!currentValid) {
    throw new AuthError(401, 'Mevcut şifre hatalı');
  }

  const hashedPassword = await hashPassword(data.newPassword);
  await updateUserById(auth.userId, {
    $set: {
      password: hashedPassword,
      passwordChangedAt: new Date(),
    },
  });
  await revokeAllSessions(auth.userId);
};
