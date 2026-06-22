import { describe, expect, it } from 'vitest';
import { objectIdSchema, safeString, uuidSchema } from '@/shared/validation/common-schemas';

describe('objectIdSchema', () => {
  it('geçerli ObjectId kabul eder', () => {
    expect(objectIdSchema.safeParse('507f1f77bcf86cd799439011').success).toBe(true);
  });

  it('geçersiz ObjectId reddeder', () => {
    expect(objectIdSchema.safeParse('invalid-id').success).toBe(false);
  });
});

describe('uuidSchema', () => {
  it('geçerli UUID kabul eder', () => {
    expect(uuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true);
  });

  it('geçersiz UUID reddeder', () => {
    expect(uuidSchema.safeParse('507f1f77bcf86cd799439011').success).toBe(false);
  });
});

describe('safeString', () => {
  const nameSchema = safeString({ min: 2, max: 50, label: 'Ad' });

  it('mongo operatörü içeren değeri reddeder', () => {
    expect(nameSchema.safeParse('$ne').success).toBe(false);
  });

  it('trim uygular', () => {
    const parsed = nameSchema.safeParse('  Ali  ');
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toBe('Ali');
    }
  });
});
