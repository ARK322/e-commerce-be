import type { FastifyInstance } from 'fastify';
import { AUTH_SELLER_RATE_LIMIT } from '@/middleware/presets/rate-limit';
import { registerScopedRateLimit } from '@/plugins/rate-limit/register-scoped';
import sellersRoutes from '@/features/sellers/sellers.routes';

export const registerSellerRoutes = async (app: FastifyInstance): Promise<void> => {
  await app.register(
    async (sellerScope) => {
      await registerScopedRateLimit(sellerScope, AUTH_SELLER_RATE_LIMIT);
      await sellerScope.register(sellersRoutes, { prefix: '/seller' });
    },
    { prefix: '/auth' }
  );
};
