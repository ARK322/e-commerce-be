import { createLogger } from '@/lib/common/logger';
import { sendUserVerificationEmail } from '@/features/auth/core/mail/send-verification';
import {
  assertRegisterEmailCooldown,
  EmailCooldownError,
  markRegisterEmailCooldown,
  markVerificationEmailSent,
} from '@/features/auth/core/mail/cooldown';
import {
  deleteUnverifiedUser,
  getVerificationExpiresAt,
} from '@/features/auth/core/register/unverified-user';
import { invalidateAuthOtp } from '@/features/auth/core/otp/otp';
import { hashPassword } from '@/lib/common/password';
import { createUserId } from '@/lib/common/user-id';
import { User, Buyer, Seller } from '@/db';
import { AuthError } from '@/features/auth/core/errors';
import type { RegisterInput } from '@/features/auth/credentials/register/register.schema';

const log = createLogger({ module: 'register' });

const resolveEmailForRegister = async (email: string) => {
  const existing = await User.findOne({ email: email.toLowerCase() });

  if (!existing) {
    return;
  }

  if (existing.isEmailVerified) {
    throw new AuthError(409, 'Bu e-posta adresi zaten kayıtlı');
  }

  await deleteUnverifiedUser(String(existing._id));
};

const createUserWithProfile = async (
  email: string,
  password: string,
  role: 'buyer' | 'seller'
) => {
  const hashedPassword = await hashPassword(password);
  const userId = createUserId();

  const user = await User.create({
    _id: userId,
    email,
    password: hashedPassword,
    role,
    isActive: false,
    isEmailVerified: false,
    verificationExpiresAt: getVerificationExpiresAt(),
  });

  try {
    if (role === 'buyer') {
      await Buyer.create({ _id: userId });
    } else {
      await Seller.create({ _id: userId });
    }
  } catch {
    await deleteUnverifiedUser(userId);
    throw new AuthError(500, 'Kayıt tamamlanamadı, lütfen tekrar deneyin');
  }

  try {
    await sendUserVerificationEmail(userId, email);
    await markRegisterEmailCooldown(email);
    await markVerificationEmailSent(userId);
  } catch (error) {
    log.error({ err: error, userId, email }, 'Doğrulama e-postası gönderilemedi');
    await markRegisterEmailCooldown(email);
    await invalidateAuthOtp(userId, 'email_verify');
    await deleteUnverifiedUser(userId);
    throw new AuthError(
      503,
      'Doğrulama e-postası gönderilemedi, lütfen tekrar deneyin'
    );
  }

  return { user };
};

export const register = async (data: RegisterInput) => {
  const { email, password, role } = data;
  const normalizedEmail = email.toLowerCase();

  try {
    await assertRegisterEmailCooldown(normalizedEmail);
  } catch (error) {
    if (error instanceof EmailCooldownError) {
      throw new AuthError(error.statusCode, error.message);
    }

    throw error;
  }

  await resolveEmailForRegister(normalizedEmail);
  return createUserWithProfile(normalizedEmail, password, role);
};
