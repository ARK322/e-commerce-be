import type { FastifyInstance } from 'fastify';
import { BUYERS_RATE_LIMIT } from '@/middleware/presets/rate-limit';
import { registerScopedRateLimit } from '@/plugins/rate-limit/register-scoped';
import cartRoutes from '@/features/buyers/cart/cart.routes';
import orderRoutes from '@/features/buyers/orders/order.routes';
import paymentRoutes from '@/features/payment/payment.routes';
import supportRoutes from '@/features/buyers/support/support.routes';

export const registerCommerceRoutes = async (app: FastifyInstance): Promise<void> => {
  await app.register(async (commerceScope) => {
    await registerScopedRateLimit(commerceScope, BUYERS_RATE_LIMIT);
    await commerceScope.register(cartRoutes, { prefix: '/cart' });
    await commerceScope.register(orderRoutes, { prefix: '/orders' });
    await commerceScope.register(paymentRoutes, { prefix: '/payments' });
    await commerceScope.register(supportRoutes, { prefix: '/support' });
  });
};
