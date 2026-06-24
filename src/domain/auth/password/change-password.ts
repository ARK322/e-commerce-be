import type { AuthTokenPayload } from '@/domain/auth/tokens/access-token';
import { hashPassword, comparePassword } from '@/shared/security';
import { AuthError } from '@/domain/auth/errors';
import { findUserById, updateUserById } from '@/repositories/auth/user.repository';
import { revokeAllSessions } from '@/domain/auth/tokens/invalidate-all';

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export const changePassword = async (auth: AuthTokenPayload, data: ChangePasswordInput) => {
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
