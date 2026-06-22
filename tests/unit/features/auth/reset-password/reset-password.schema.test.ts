import { describe, expect, it } from 'vitest';
import {
  resetPasswordByCodeSchema,
  resetPasswordByTokenSchema,
  resetPasswordSchema,
} from '@/features/auth/reset-password/reset-password.schema';

describe('resetPasswordSchema', () => {
  it('token + newPassword gövdesini kabul eder', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'eyJ.valid.token',
      newPassword: 'SecurePass1',
    });
    expect(result.success).toBe(true);
  });

  it('email + code + newPassword gövdesini kabul eder', () => {
    const result = resetPasswordSchema.safeParse({
      email: 'user@example.com',
      code: '482913',
      newPassword: 'SecurePass1',
    });
    expect(result.success).toBe(true);
  });

  it('zayıf şifreyi reddeder', () => {
    const result = resetPasswordByTokenSchema.safeParse({
      token: 'eyJ.valid.token',
      newPassword: 'password',
    });
    expect(result.success).toBe(false);
  });

  it('eksik kod alanını reddeder', () => {
    const result = resetPasswordByCodeSchema.safeParse({
      email: 'user@example.com',
      newPassword: 'SecurePass1',
    });
    expect(result.success).toBe(false);
  });
});
