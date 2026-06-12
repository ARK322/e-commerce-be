import crypto from 'crypto';
import { AuthOtp, AuthOtpPurpose } from '../../../db';
import { comparePassword, hashPassword } from '../../common/password';

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

  await AuthOtp.findOneAndUpdate(
    { userId, purpose },
    { codeHash, expiresAt, attemptCount: 0 },
    { upsert: true, returnDocument: 'after' }
  );

  return code;
};

export const verifyAuthOtp = async (
  userId: string,
  purpose: AuthOtpPurpose,
  code: string
): Promise<void> => {
  const otp = await AuthOtp.findOne({ userId, purpose });

  if (!otp) {
    throw new OtpError(400, 'Doğrulama kodu geçersiz veya süresi dolmuş');
  }

  if (otp.expiresAt < new Date()) {
    await AuthOtp.deleteOne({ _id: otp._id });
    throw new OtpError(410, 'Doğrulama kodunun süresi doldu');
  }

  if (otp.attemptCount >= MAX_OTP_ATTEMPTS) {
    await AuthOtp.deleteOne({ _id: otp._id });
    throw new OtpError(429, 'Çok fazla hatalı deneme. Yeni kod isteyin');
  }

  const valid = await comparePassword(code, otp.codeHash);

  if (!valid) {
    otp.attemptCount += 1;
    await otp.save();

    if (otp.attemptCount >= MAX_OTP_ATTEMPTS) {
      await AuthOtp.deleteOne({ _id: otp._id });
      throw new OtpError(429, 'Çok fazla hatalı deneme. Yeni kod isteyin');
    }

    throw new OtpError(400, 'Doğrulama kodu hatalı');
  }

  await AuthOtp.deleteOne({ _id: otp._id });
};

export const invalidateAuthOtp = async (userId: string, purpose: AuthOtpPurpose) => {
  await AuthOtp.deleteOne({ userId, purpose });
};
