import { describe, expect, it } from 'vitest';
import { sellerTeamBase } from '@/middleware/presets/seller-route-guards';
import { requireAuth } from '@/middleware/auth/require-auth';
import { requireEmailVerified } from '@/middleware/auth/require-email-verified';
import {
  requireApprovedSeller,
  requireKurumsalSeller,
} from '@/middleware/ecommerce/require-approved-seller';

describe('sellerTeamBase', () => {
  it('seller ekip guard zincirini korur', () => {
    expect(sellerTeamBase.preHandler).toEqual([
      requireAuth,
      requireEmailVerified,
      requireApprovedSeller,
      requireKurumsalSeller,
    ]);
  });
});
