import { describe, expect, it } from 'vitest';
import { emailSchema } from '@/domain/auth/schemas/email.schema';

describe('emailSchema', () => {
  it('geçersiz email reddeder', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });
});
