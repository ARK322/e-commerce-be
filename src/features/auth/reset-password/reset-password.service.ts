import jwt from 'jsonwebtoken';
import { verifyPasswordResetToken } from '../../../lib/auth/email-token';
import { hashPassword } from '../../../lib/common/password';
import { User } from '../../../db';
import { RegisterError } from '../register/register.errors';

export const resetPassword = async (token: string, newPassword: string) => {
  let userId: string;

  try {
    userId = verifyPasswordResetToken(token);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new RegisterError(410, 'Sıfırlama bağlantısının süresi doldu');
    }

    throw new RegisterError(400, 'Geçersiz sıfırlama tokeni');
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new RegisterError(404, 'Kullanıcı bulunamadı');
  }

  const hashedPassword = await hashPassword(newPassword);
  await User.findByIdAndUpdate(userId, { password: hashedPassword });
};
