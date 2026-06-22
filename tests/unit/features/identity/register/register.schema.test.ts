import { describe, expect, it } from 'vitest';
import { registerSchema } from '@/api/auth/register/register.schema';

describe('registerSchema', () => {
  it('geçerli kayıt gövdesini kabul eder', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'SecurePass1',
      role: 'buyer',
    });
    expect(result.success).toBe(true);
  });

  it('geçersiz rolü reddeder', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'SecurePass1',
      role: 'admin',
    });
    expect(result.success).toBe(false);
  });

  it('fazladan alanı reddeder', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'SecurePass1',
      role: 'buyer',
      extra: true,
    });
    expect(result.success).toBe(false);
  });
});
