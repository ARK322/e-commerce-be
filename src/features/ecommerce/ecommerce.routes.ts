import { FastifyInstance } from 'fastify';
import productRoutes from './product/product.routes';
import cartRoutes from './cart/cart.routes';
import orderRoutes from './order/order.routes';
import paymentRoutes from './payment/payment.routes';

export default async function ecommerceRoutes(fastify: FastifyInstance) {
  await fastify.register(productRoutes, { prefix: '/products' });
  await fastify.register(cartRoutes, { prefix: '/cart' });
  await fastify.register(orderRoutes, { prefix: '/orders' });
  await fastify.register(paymentRoutes, { prefix: '/payments' });
}
