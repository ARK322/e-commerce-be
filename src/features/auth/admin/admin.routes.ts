import { FastifyInstance } from 'fastify';
import adminsRoutes from './admins/admins.routes';
import sellersRoutes from './sellers/sellers.routes';

export default async function (fastify: FastifyInstance) {
  await fastify.register(adminsRoutes, { prefix: '/admins' });
  await fastify.register(sellersRoutes, { prefix: '/sellers' });
}
