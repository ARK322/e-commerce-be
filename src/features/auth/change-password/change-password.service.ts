import type { AuthTokenPayload } from '../../../lib/auth/auth-token';
import { hashPassword, comparePassword } from '../../../lib/common/password';
import { User } from '../../../db';
import { RegisterError } from '../register/register.errors';
import type { ChangePasswordInput } from './schemas/change-password.schema';

export const changePassword = async (
  auth: AuthTokenPayload,
  data: ChangePasswordInput
) => {
  const user = await User.findById(auth.userId);

  if (!user) {
    throw new RegisterError(404, 'Kullanıcı bulunamadı');
  }

  const currentValid = await comparePassword(data.currentPassword, user.password);

  if (!currentValid) {
    throw new RegisterError(401, 'Mevcut şifre hatalı');
  }

  const hashedPassword = await hashPassword(data.newPassword);
  await User.findByIdAndUpdate(auth.userId, { password: hashedPassword });
};
