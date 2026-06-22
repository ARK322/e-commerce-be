import crypto from 'crypto';
import { AUTH_OTP_PURPOSES, buildAuthOtpId } from '@/integrations/mongo';
import type { AuthOtpPurpose } from '@/domains/identity/infrastructure/repositories/auth/auth-otp.repository';
import {
  deleteAuthOtpById,
  deleteAuthOtpsByIds,
  findAuthOtpById,
  saveAuthOtpDocument,
  upsertAuthOtp,
} from '@/domains/identity/infrastructure/repositories/auth/auth-otp.repository';
import { comparePassword, hashPassword } from '@/shared/security';

const MAX_OTP_ATTEMPTS = 5;

const OTP_EXPIRY_MS: Record<AuthOtpPurpose, number> = {
  email_verify: 24 * 60 * 60 * 1000,
  password_reset: 60 * 60 * 1000,
};

export class OtpError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export const generateOtpCode = (): string => {
  return crypto.randomInt(100000, 1000000).toString();
};

export const createAuthOtp = async (
  userId: string,
  purpose: AuthOtpPurpose
): Promise<string> => {
  const code = generateOtpCode();
  const codeHash = await hashPassword(code);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS[purpose]);
  const id = buildAuthOtpId(userId, purpose);

  await upsertAuthOtp(id, { codeHash, expiresAt, attemptCount: 0 });

  return code;
};

export const verifyAuthOtp = async (
  userId: string,
  purpose: AuthOtpPurpose,
  code: string
): Promise<void> => {
  const id = buildAuthOtpId(userId, purpose);
  const otp = await findAuthOtpById(id);

  if (!otp) {
    throw new OtpError(400, 'Doğrulama kodu geçersiz veya süresi dolmuş');
  }

  if (otp.expiresAt < new Date()) {
    await deleteAuthOtpById(id);
    throw new OtpError(410, 'Doğrulama kodunun süresi doldu');
  }

  if (otp.attemptCount >= MAX_OTP_ATTEMPTS) {
    await deleteAuthOtpById(id);
    throw new OtpError(429, 'Çok fazla hatalı deneme. Yeni kod isteyin');
  }

  const valid = await comparePassword(code, otp.codeHash);

  if (!valid) {
    otp.attemptCount += 1;
    await saveAuthOtpDocument(otp);

    if (otp.attemptCount >= MAX_OTP_ATTEMPTS) {
      await deleteAuthOtpById(id);
      throw new OtpError(429, 'Çok fazla hatalı deneme. Yeni kod isteyin');
    }

    throw new OtpError(400, 'Doğrulama kodu hatalı');
  }

  await deleteAuthOtpById(id);
};

export const invalidateAuthOtp = async (userId: string, purpose: AuthOtpPurpose) => {
  await deleteAuthOtpById(buildAuthOtpId(userId, purpose));
};

export const deleteAuthOtpsForUser = async (userId: string) => {
  await deleteAuthOtpsByIds(
    AUTH_OTP_PURPOSES.map((purpose) => buildAuthOtpId(userId, purpose))
  );
};
