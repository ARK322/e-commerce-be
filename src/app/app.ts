import fastify, { FastifyInstance } from 'fastify';
import { env } from '@/config/env';
import { registerRoutes } from '@/app/register-routes';
import { registerCors } from '@/plugins/cors/register';
import { registerErrorHandler } from '@/plugins/error-handler/register';
import { registerFormBody } from '@/plugins/formbody/register';
import { registerGlobalRateLimit } from '@/plugins/rate-limit/register-global';
import { registerSecurityHeaders } from '@/plugins/security-headers/register';

export const buildApp = async (): Promise<FastifyInstance> => {
  const app = fastify({
    logger: {
      level: env.logLevel,
    },
    trustProxy: true,
  });

  registerSecurityHeaders(app);
  registerErrorHandler(app);
  await registerCors(app);
  await registerFormBody(app);
  await registerGlobalRateLimit(app);
  await registerRoutes(app);

  return app;
};
