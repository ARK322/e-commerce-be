import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import authRoutes from '../features/auth/auth.routes';
import ecommerceRoutes from '../features/ecommerce/ecommerce.routes';

export const buildApp = async (): Promise<FastifyInstance> => {
  const app = fastify({ logger: false });

  app.setErrorHandler((error: unknown, _request, reply) => {
    const statusCode =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;

    const message =
      statusCode >= 500
        ? 'Sunucu hatası'
        : error instanceof Error
          ? error.message
          : 'İstek işlenemedi';

    reply.status(statusCode).send({ message });
  });

  await app.register(cors, { origin: true });

  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
  });

  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(ecommerceRoutes);

  return app;
};
