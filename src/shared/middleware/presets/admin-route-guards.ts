import { requireAuth } from '@/shared/middleware/auth/require-auth';
import { requireAdmin } from '@/shared/middleware/auth/require-admin';

export const adminOnly = {
  preHandler: [requireAuth, requireAdmin],
};
