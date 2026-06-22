import { FastifyInstance } from 'fastify';
import { CATALOG_PUBLIC_RATE_LIMIT } from '@/shared/middleware/presets/rate-limit';
import { registerScopedRateLimit } from '@/shared/plugins/rate-limit/register-scoped';
import categoryRoutes from '@/api/public/catalog/categories/category.routes';
import publicProductRoutes from '@/api/public/catalog/products/products.routes';

export default async function catalogRoutes(fastify: FastifyInstance) {
  await fastify.register(async (publicScope) => {
    await registerScopedRateLimit(publicScope, CATALOG_PUBLIC_RATE_LIMIT);
    await publicScope.register(categoryRoutes, { prefix: '/categories' });
    await publicScope.register(publicProductRoutes, { prefix: '/products' });
  });
}
