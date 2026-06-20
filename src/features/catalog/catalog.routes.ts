import { FastifyInstance } from 'fastify';
import { CATALOG_PUBLIC_RATE_LIMIT } from '@/middleware/presets/rate-limit';
import { registerScopedRateLimit } from '@/plugins/rate-limit/register-scoped';
import categoryRoutes from '@/features/catalog/categories/category.routes';
import publicProductRoutes from '@/features/catalog/products/products.routes';
import sellerProductRoutes from '@/features/sellers/products/products.routes';

export default async function catalogRoutes(fastify: FastifyInstance) {
  await fastify.register(async (publicScope) => {
    await registerScopedRateLimit(publicScope, CATALOG_PUBLIC_RATE_LIMIT);
    await publicScope.register(categoryRoutes, { prefix: '/categories' });
    await publicScope.register(publicProductRoutes, { prefix: '/products' });
  });

  await fastify.register(sellerProductRoutes, { prefix: '/products' });
}
