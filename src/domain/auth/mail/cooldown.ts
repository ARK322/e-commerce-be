import { buildAuthEmailCooldownId } from '@/infrastructure/mongo';
import {
  findAuthEmailCooldownById,
  upsertAuthEmailCooldownSentAt,
} from '@/repositories/auth/auth-email-cooldown.repository';
import {
  findUserByEmailLean,
  updateUserById,
} from '@/repositories/auth/user.repository';

export const EMAIL_COOLDOWN_MS = 60_000;

export class EmailCooldownError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export const getEmailCooldownRemainingSeconds = (
  lastSentAt: Date | null | undefined
): number => {
  if (!lastSentAt) {
    return 0;
  }

  const remainingMs = EMAIL_COOLDOWN_MS - (Date.now() - lastSentAt.getTime());
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
};

export const assertEmailCooldown = (lastSentAt: Date | null | undefined) => {
  const remainingSeconds = getEmailCooldownRemainingSeconds(lastSentAt);

  if (remainingSeconds > 0) {
    throw new EmailCooldownError(
      429,
      `E-posta az önce gönderildi. ${remainingSeconds} saniye sonra tekrar deneyin`
    );
  }
};

export const markVerificationEmailSent = async (userId: string) => {
  await updateUserById(userId, { $set: { verificationEmailSentAt: new Date() } });
};

export const markPasswordResetEmailSent = async (userId: string) => {
  await updateUserById(userId, { $set: { passwordResetEmailSentAt: new Date() } });
};

export const assertRegisterEmailCooldown = async (email: string) => {
  const normalized = email.toLowerCase();
  const record = await findAuthEmailCooldownById(
    buildAuthEmailCooldownId(normalized, 'register')
  );
  assertEmailCooldown(record?.sentAt);

  const user = await findUserByEmailLean(normalized, 'isEmailVerified verificationEmailSentAt');

  if (user && !user.isEmailVerified) {
    assertEmailCooldown(user.verificationEmailSentAt as Date | null | undefined);
  }
};

export const markRegisterEmailCooldown = async (email: string) => {
  const normalized = email.toLowerCase();
  const id = buildAuthEmailCooldownId(normalized, 'register');

  await upsertAuthEmailCooldownSentAt(id, new Date());
};
