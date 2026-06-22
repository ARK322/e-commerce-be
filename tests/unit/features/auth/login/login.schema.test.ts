import { describe, expect, it } from 'vitest';
import { loginSchema } from '@/features/auth/login/login.schema';

describe('loginSchema', () => {
  it('rememberMe default false', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'secret',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rememberMe).toBe(false);
    }
  });
});
