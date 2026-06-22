import { describe, expect, it } from 'vitest';
import { resendVerificationSchema } from '@/features/auth/resend-verification/resend-verification.schema';

describe('resendVerificationSchema', () => {
  it('email zorunludur', () => {
    const result = resendVerificationSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
