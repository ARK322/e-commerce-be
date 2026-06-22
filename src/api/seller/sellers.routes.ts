import { FastifyInstance } from 'fastify';
import membersRoutes from '@/api/seller/members/members.routes';
import rolesRoutes from '@/api/seller/roles/roles.routes';
import sellerProductRoutes from '@/api/seller/products/products.routes';
import walletRoutes from '@/api/seller/wallet/wallet.routes';
import supportRoutes from '@/api/seller/support/support.routes';

export default async function sellersRoutes(fastify: FastifyInstance) {
  await fastify.register(membersRoutes, { prefix: '/members' });
  await fastify.register(rolesRoutes, { prefix: '/roles' });
  await fastify.register(sellerProductRoutes, { prefix: '/products' });
  await fastify.register(walletRoutes, { prefix: '/wallet' });
  await fastify.register(supportRoutes, { prefix: '/support' });
}
