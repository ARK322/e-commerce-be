import { Schema, model } from 'mongoose';

export const AUTH_EMAIL_COOLDOWN_PURPOSES = ['register', 'password_reset', 'email_verify'] as const;
export type AuthEmailCooldownPurpose = (typeof AUTH_EMAIL_COOLDOWN_PURPOSES)[number];

export const buildAuthEmailCooldownId = (
  email: string,
  purpose: AuthEmailCooldownPurpose
) => `${email.toLowerCase()}:${purpose}`;

const authEmailCooldownSchema = new Schema(
  {
    _id: { type: String, required: true },
    sentAt: { type: Date, required: true, expires: 60 },
  },
  { strict: true }
);

export const AuthEmailCooldown = model('AuthEmailCooldown', authEmailCooldownSchema);
