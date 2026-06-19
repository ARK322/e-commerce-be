import { Schema, model } from 'mongoose';
import { validateEmail } from '@/internal/validation/mongo-validators';

const userSchema = new Schema(
  {
    _id: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      validate: {
        validator: validateEmail,
        message: 'Geçersiz e-posta adresi',
      },
    },
    password: { type: String, required: true, maxlength: 128 },
    passwordChangedAt: { type: Date, default: null },
    sessionsRevokedAt: { type: Date, default: null },
    role: { type: String, enum: ['buyer', 'seller', 'admin'], required: true },
    isActive: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    verificationExpiresAt: { type: Date, default: null },
    verificationEmailSentAt: { type: Date, default: null },
    passwordResetEmailSentAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { strict: true }
);

userSchema.index({ role: 1 });
userSchema.index(
  { verificationExpiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { isEmailVerified: false },
  }
);

export const User = model('User', userSchema);
