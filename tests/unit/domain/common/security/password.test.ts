import { describe, expect, it } from 'vitest';
import { comparePassword, hashPassword } from '@/shared/security';

describe('password', () => {
  it('hash ve compare birbiriyle uyumludur', async () => {
    const hashed = await hashPassword('SecurePass1');

    expect(hashed).not.toBe('SecurePass1');
    expect(await comparePassword('SecurePass1', hashed)).toBe(true);
    expect(await comparePassword('WrongPass1', hashed)).toBe(false);
  });
});
