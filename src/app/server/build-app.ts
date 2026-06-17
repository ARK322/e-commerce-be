import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { HttpError } from '@/lib/common/errors';
import { corsOriginHandler } from '@/app/config/cors-config';
import { registerRoutes } from '@/app/routes/register-routes';

export const buildApp = async (): Promise<FastifyInstance> => {
  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  app.setErrorHandler((error: unknown, _request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({ message: error.message });
    }

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

  await app.register(cors, {
    origin: corsOriginHandler,
    // Default is GET,HEAD,POST only — PATCH/PUT/DELETE blocked in browser preflight
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
  });

  await registerRoutes(app);

  return app;
};
