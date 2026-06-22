import { describe, expect, it } from 'vitest';
import { buyerProfileUpdateSchema } from '@/api/buyer/profile/profile.schema';

describe('buyerProfileUpdateSchema', () => {
  it('boş gövde reddedilir', () => {
    const result = buyerProfileUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('en az bir alan kabul edilir', () => {
    const result = buyerProfileUpdateSchema.safeParse({ firstName: 'Ali' });
    expect(result.success).toBe(true);
  });
});
