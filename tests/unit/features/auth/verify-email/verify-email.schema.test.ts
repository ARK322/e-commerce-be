import { describe, expect, it } from 'vitest';
import {
  verifyEmailByCodeSchema,
  verifyEmailByTokenSchema,
  verifyEmailSchema,
} from '@/features/auth/verify-email/verify-email.schema';

describe('verifyEmailSchema', () => {
  it('token gövdesini kabul eder', () => {
    const result = verifyEmailSchema.safeParse({ token: 'eyJ.valid.token' });
    expect(result.success).toBe(true);
  });

  it('email + code gövdesini kabul eder', () => {
    const result = verifyEmailSchema.safeParse({
      email: 'user@example.com',
      code: '482913',
    });
    expect(result.success).toBe(true);
  });

  it('5 haneli kodu reddeder', () => {
    const result = verifyEmailByCodeSchema.safeParse({
      email: 'user@example.com',
      code: '48291',
    });
    expect(result.success).toBe(false);
  });

  it('harf içeren kodu reddeder', () => {
    const result = verifyEmailByCodeSchema.safeParse({
      email: 'user@example.com',
      code: '48291a',
    });
    expect(result.success).toBe(false);
  });

  it('boş tokeni reddeder', () => {
    const result = verifyEmailByTokenSchema.safeParse({ token: '' });
    expect(result.success).toBe(false);
  });
});
