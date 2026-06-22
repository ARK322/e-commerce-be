import { requireAuth } from '@/shared/middleware/auth/require-auth';
import { requireEmailVerified } from '@/shared/middleware/auth/require-email-verified';
import {
  requireApprovedSeller,
  requireKurumsalSeller,
} from '@/shared/middleware/sellers/require-approved-seller';

export const sellerTeamBase = {
  preHandler: [requireAuth, requireEmailVerified, requireApprovedSeller, requireKurumsalSeller],
};
