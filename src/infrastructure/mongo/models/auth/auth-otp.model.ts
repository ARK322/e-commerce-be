import { Schema, model } from 'mongoose';

export const AUTH_OTP_PURPOSES = ['email_verify', 'password_reset'] as const;
export type AuthOtpPurpose = (typeof AUTH_OTP_PURPOSES)[number];

export const buildAuthOtpId = (userId: string, purpose: AuthOtpPurpose) =>
  `${userId}:${purpose}`;

const authOtpSchema = new Schema(
  {
    _id: { type: String, required: true },
    codeHash: { type: String, required: true, maxlength: 128 },
    expiresAt: { type: Date, required: true, expires: 0 },
    attemptCount: { type: Number, default: 0, min: 0 },
  },
  { strict: true }
);

export const AuthOtp = model('AuthOtp', authOtpSchema);
