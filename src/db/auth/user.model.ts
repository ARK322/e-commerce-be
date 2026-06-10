import { Schema, model } from 'mongoose';
import { validateEmail } from '../validators';

const userSchema = new Schema(
  {
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
    role: { type: String, enum: ['buyer', 'seller', 'admin'], required: true },
    isActive: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { strict: true }
);

userSchema.index({ role: 1 });

export const User = model('User', userSchema);
