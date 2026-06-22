import { createLogger } from '@/shared/logging';
import { sendUserVerificationEmail } from '@/domains/identity/application/mail/send-verification';
import {
  assertRegisterEmailCooldown,
  EmailCooldownError,
  markRegisterEmailCooldown,
  markVerificationEmailSent,
} from '@/domains/identity/application/mail/cooldown';
import {
  deleteUnverifiedUser,
  getVerificationExpiresAt,
} from '@/domains/identity/application/register/unverified-user';
import {
  buildRegisterAckResponse,
} from '@/domains/identity/application/register/register-response';
import { invalidateAuthOtp } from '@/domains/identity/application/otp/otp';
import { hashPassword } from '@/shared/security';
import { createUserId } from '@/shared/ids';
import { AuthError } from '@/domains/identity/application/errors';
import { createUser, findUserByEmail } from '@/domains/identity/infrastructure/repositories/auth/user.repository';
import { createBuyerProfile } from '@/domains/identity/infrastructure/repositories/buyer.repository';
import { createSellerProfile } from '@/domains/identity/infrastructure/repositories/seller.repository';
import type { RegisterInput } from '@/api/auth/register/register.schema';

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
