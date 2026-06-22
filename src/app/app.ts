import fastify, { FastifyInstance } from 'fastify';
import { env } from '@/config/env';
import { registerRoutes } from '@/app/register-routes';
import { registerPlugins } from '@/bootstrap/register-plugins';

export const buildApp = async (): Promise<FastifyInstance> => {
  const app = fastify({
    logger: {
      level: env.logLevel,
    },
    trustProxy: true,
  });

  await registerPlugins(app);
  await registerRoutes(app);

  return app;
};
