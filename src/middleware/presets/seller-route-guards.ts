import { requireAuth } from '@/middleware/auth/require-auth';
import { requireEmailVerified } from '@/middleware/auth/require-email-verified';
import {
  requireApprovedSeller,
  requireKurumsalSeller,
} from '@/middleware/ecommerce/require-approved-seller';

export const sellerTeamBase = {
  preHandler: [requireAuth, requireEmailVerified, requireApprovedSeller, requireKurumsalSeller],
};
