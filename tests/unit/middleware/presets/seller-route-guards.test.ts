import { describe, expect, it } from 'vitest';
import { sellerTeamBase } from '@/shared/middleware/presets/seller-route-guards';
import { requireAuth } from '@/shared/middleware/auth/require-auth';
import { requireEmailVerified } from '@/shared/middleware/auth/require-email-verified';
import {
  requireApprovedSeller,
  requireKurumsalSeller,
} from '@/shared/middleware/sellers/require-approved-seller';

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
