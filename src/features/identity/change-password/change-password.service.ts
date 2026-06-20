import type { AuthTokenPayload } from '@/internal/auth/tokens/access-token';
import { hashPassword, comparePassword } from '@/internal/common/security';
import { AuthError } from '@/internal/auth/errors';
import {
  findUserById,
  updateUserById,
} from '@/repositories/auth/user.repository';
import type { ChangePasswordInput } from '@/features/identity/change-password/change-password.schema';

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
};
