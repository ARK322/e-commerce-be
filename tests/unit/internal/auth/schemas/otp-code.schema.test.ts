import { describe, expect, it } from 'vitest';
import { otpCodeSchema } from '@/domains/identity/application/schemas/otp-code.schema';

describe('otpCodeSchema', () => {
  it('6 hane ister', () => {
    expect(otpCodeSchema.safeParse('12345').success).toBe(false);
    expect(otpCodeSchema.safeParse('123456').success).toBe(true);
  });
});
