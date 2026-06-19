import { FastifyInstance } from 'fastify';
import {
  ECOMMERCE_ADMIN_RATE_LIMIT,
  ECOMMERCE_BUYER_RATE_LIMIT,
  ECOMMERCE_PUBLIC_RATE_LIMIT,
} from '@/middleware/presets/rate-limit';
import { registerScopedRateLimit } from '@/plugins/rate-limit/register-scoped';
import productRoutes from '@/features/ecommerce/product/product.routes';
import cartRoutes from '@/features/ecommerce/cart/cart.routes';
import orderRoutes from '@/features/ecommerce/order/order.routes';
import paymentRoutes from '@/features/ecommerce/payment/payment.routes';
import categoryRoutes from '@/features/ecommerce/category/category.routes';
import categoriesAdminRoutes from '@/features/ecommerce/category/admin/admin.routes';

export default async function ecommerceRoutes(fastify: FastifyInstance) {
  await fastify.register(async (publicScope) => {
    await registerScopedRateLimit(publicScope, ECOMMERCE_PUBLIC_RATE_LIMIT);
    await publicScope.register(categoryRoutes, { prefix: '/categories' });
  });

  await fastify.register(productRoutes, { prefix: '/products' });

  await fastify.register(async (adminScope) => {
    await registerScopedRateLimit(adminScope, ECOMMERCE_ADMIN_RATE_LIMIT);
    await adminScope.register(categoriesAdminRoutes, { prefix: '/admin/categories' });
  });

  await fastify.register(async (buyerScope) => {
    await registerScopedRateLimit(buyerScope, ECOMMERCE_BUYER_RATE_LIMIT);
    await buyerScope.register(cartRoutes, { prefix: '/cart' });
    await buyerScope.register(orderRoutes, { prefix: '/orders' });
    await buyerScope.register(paymentRoutes, { prefix: '/payments' });
  });
}
