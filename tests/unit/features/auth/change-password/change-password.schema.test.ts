import { describe, expect, it } from 'vitest';
import { changePasswordSchema } from '@/features/auth/change-password/change-password.schema';

describe('changePasswordSchema', () => {
  it('aynı şifreyi reddeder', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'SecurePass1',
      newPassword: 'SecurePass1',
    });
    expect(result.success).toBe(false);
  });
});
