import { FastifyInstance } from 'fastify';
import registerRoutes from './register/register.routes';

export default async function (fastify: FastifyInstance) {
  await fastify.register(registerRoutes, { prefix: '/register' });
}
