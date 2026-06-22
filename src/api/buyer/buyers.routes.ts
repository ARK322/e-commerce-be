import { FastifyInstance } from 'fastify';
import { BUYERS_RATE_LIMIT } from '@/shared/middleware/presets/rate-limit';
import { registerScopedRateLimit } from '@/shared/plugins/rate-limit/register-scoped';
import cartRoutes from '@/api/buyer/cart/cart.routes';
import orderRoutes from '@/api/buyer/orders/order.routes';
import sellerOrderRoutes from '@/api/seller/orders/seller-order.routes';
import paymentRoutes from '@/api/buyer/payments/payment.routes';
import supportRoutes from '@/api/buyer/support/support.routes';

export default async function buyersRoutes(fastify: FastifyInstance) {
  await registerScopedRateLimit(fastify, BUYERS_RATE_LIMIT);
  await fastify.register(cartRoutes, { prefix: '/cart' });
  await fastify.register(orderRoutes, { prefix: '/orders' });
  await fastify.register(sellerOrderRoutes, { prefix: '/orders' });
  await fastify.register(paymentRoutes, { prefix: '/payments' });
  await fastify.register(supportRoutes, { prefix: '/support' });
}
