import { FastifyInstance } from 'fastify';
import { BUYERS_RATE_LIMIT } from '@/middleware/presets/rate-limit';
import { registerScopedRateLimit } from '@/plugins/rate-limit/register-scoped';
import cartRoutes from '@/features/buyers/cart/cart.routes';
import orderRoutes from '@/features/buyers/orders/order.routes';
import paymentRoutes from '@/features/buyers/payment/payment.routes';
import supportRoutes from '@/features/buyers/support/support.routes';

export default async function buyersRoutes(fastify: FastifyInstance) {
  await registerScopedRateLimit(fastify, BUYERS_RATE_LIMIT);
  await fastify.register(cartRoutes, { prefix: '/cart' });
  await fastify.register(orderRoutes, { prefix: '/orders' });
  await fastify.register(paymentRoutes, { prefix: '/payments' });
  await fastify.register(supportRoutes, { prefix: '/support' });
}
