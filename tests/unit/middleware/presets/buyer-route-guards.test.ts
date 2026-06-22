import { describe, expect, it } from 'vitest';
import { buyerOnly } from '@/shared/middleware/presets/buyer-route-guards';
import { requireAuth } from '@/shared/middleware/auth/require-auth';
import { requireEmailVerified } from '@/shared/middleware/auth/require-email-verified';
import { requireActiveBuyer } from '@/shared/middleware/buyers/require-active-buyer';

describe('buyerOnly', () => {
  it('buyer guard zincirini korur', () => {
    expect(buyerOnly.preHandler).toEqual([
      requireAuth,
      requireEmailVerified,
      requireActiveBuyer,
    ]);
  });
});
