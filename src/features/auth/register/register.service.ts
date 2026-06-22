import { createLogger } from '@/shared/logging';
import { sendUserVerificationEmail } from '@/domain/auth/mail/send-verification';
import {
  assertRegisterEmailCooldown,
  EmailCooldownError,
  markRegisterEmailCooldown,
  markVerificationEmailSent,
} from '@/domain/auth/mail/cooldown';
import {
  deleteUnverifiedUser,
  getVerificationExpiresAt,
} from '@/domain/auth/register/unverified-user';
import {
  buildRegisterAckResponse,
} from '@/domain/auth/register/register-response';
import { invalidateAuthOtp } from '@/domain/auth/otp/otp';
import { hashPassword } from '@/shared/security';
import { createUserId } from '@/shared/ids';
import { AuthError } from '@/domain/auth/errors';
import { createUser, findUserByEmail } from '@/repositories/auth/user.repository';
import { createBuyerProfile } from '@/repositories/buyers/buyer.repository';
import { createSellerProfile } from '@/repositories/sellers/seller.repository';
import type { RegisterInput } from '@/features/auth/register/register.schema';

const log = createLogger({ module: 'register' });

const resolveEmailForRegister = async (email: string) => {
  const existing = await findUserByEmail(email);

  if (!existing) {
    return;
  }

  if (existing.isEmailVerified) {
    return 'verified' as const;
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

  const user = await createUser({
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
      await createBuyerProfile(userId);
    } else {
      await createSellerProfile(userId);
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
    return null;
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
      return buildRegisterAckResponse();
    }

    throw error;
  }

  const existingState = await resolveEmailForRegister(normalizedEmail);

  if (existingState === 'verified') {
    return buildRegisterAckResponse();
  }

  const created = await createUserWithProfile(normalizedEmail, password, role);

  if (!created) {
    return buildRegisterAckResponse();
  }

  return buildRegisterAckResponse();
};
