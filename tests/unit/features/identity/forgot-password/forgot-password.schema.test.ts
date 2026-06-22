import { describe, expect, it } from 'vitest';
import { forgotPasswordSchema } from '@/api/auth/forgot-password/forgot-password.schema';

describe('forgotPasswordSchema', () => {
  it('geçerli email kabul edilir', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });
});
