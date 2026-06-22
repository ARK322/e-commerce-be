import type { FastifyInstance } from 'fastify';
import { AUTH_ADMIN_RATE_LIMIT } from '@/middleware/presets/rate-limit';
import { registerScopedRateLimit } from '@/plugins/rate-limit/register-scoped';
import adminRoutes from '@/features/admin/admin.routes';

export const registerAdminRoutes = async (app: FastifyInstance): Promise<void> => {
  await app.register(
    async (adminScope) => {
      await registerScopedRateLimit(adminScope, AUTH_ADMIN_RATE_LIMIT);
      await adminScope.register(adminRoutes, { prefix: '/admin' });
    },
    { prefix: '/auth' }
  );
};
