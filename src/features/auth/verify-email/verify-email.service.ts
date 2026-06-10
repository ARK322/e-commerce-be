import jwt from 'jsonwebtoken';
import { verifyEmailVerificationToken } from '../../../lib/auth/email-token';
import { User } from '../../../db';
import { RegisterError } from '../register/register.errors';

export const verifyEmail = async (token: string) => {
  let userId: string;

  try {
    userId = verifyEmailVerificationToken(token);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new RegisterError(410, 'Doğrulama bağlantısının süresi doldu');
    }

    throw new RegisterError(400, 'Geçersiz doğrulama tokeni');
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new RegisterError(404, 'Kullanıcı bulunamadı');
  }

  if (user.isEmailVerified) {
    throw new RegisterError(409, 'E-posta zaten doğrulanmış');
  }

  user.isEmailVerified = true;
  await user.save();

  return user;
};
