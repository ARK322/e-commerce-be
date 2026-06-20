import type { FastifyInstance } from 'fastify';
import { ADMIN_CATEGORIES_RATE_LIMIT } from '@/middleware/presets/rate-limit';
import { registerScopedRateLimit } from '@/plugins/rate-limit/register-scoped';
import { registerAuthRoutes } from '@/app/register-auth-routes';
import { registerHealthRoutes } from '@/app/health.routes';
import catalogRoutes from '@/features/catalog/catalog.routes';
import buyersRoutes from '@/features/buyers/buyers.routes';
import categoriesAdminRoutes from '@/features/admin/categories/categories.routes';

export const registerRoutes = async (app: FastifyInstance): Promise<void> => {
  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await app.register(catalogRoutes);
  await app.register(buyersRoutes);

  await app.register(async (adminScope) => {
    await registerScopedRateLimit(adminScope, ADMIN_CATEGORIES_RATE_LIMIT);
    await adminScope.register(categoriesAdminRoutes, { prefix: '/admin/categories' });
  });
};
