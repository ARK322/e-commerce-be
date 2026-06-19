import { beforeEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  signEmailVerificationToken,
  signPasswordResetToken,
  verifyEmailVerificationToken,
  verifyPasswordResetToken,
} from '@/internal/auth/tokens/email-token';

const userId = '550e8400-e29b-41d4-a716-446655440000';

describe('email-token', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';
  });

  it('email verification token imzalar ve doğrular', () => {
    const token = signEmailVerificationToken(userId);

    expect(verifyEmailVerificationToken(token)).toBe(userId);
  });

  it('password reset token imzalar ve doğrular', () => {
    const token = signPasswordResetToken(userId);

    expect(verifyPasswordResetToken(token)).toBe(userId);
  });

  it('yanlış purpose ile email token reddedilir', () => {
    const token = jwt.sign({ purpose: 'password_reset' }, process.env.JWT_SECRET!, {
      subject: userId,
      expiresIn: '1h',
    });

    expect(() => verifyEmailVerificationToken(token)).toThrow();
  });

  it('yanlış purpose ile reset token reddedilir', () => {
    const token = jwt.sign({ purpose: 'email_verify' }, process.env.JWT_SECRET!, {
      subject: userId,
      expiresIn: '1h',
    });

    expect(() => verifyPasswordResetToken(token)).toThrow();
  });
});
