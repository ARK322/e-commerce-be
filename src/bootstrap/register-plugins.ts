import type { FastifyInstance } from 'fastify';
import { registerCors } from '@/plugins/cors/register';
import { registerErrorHandler } from '@/plugins/error-handler/register';
import { registerFormBody } from '@/plugins/formbody/register';
import { registerGlobalRateLimit } from '@/plugins/rate-limit/register-global';
import { registerMetrics } from '@/plugins/metrics/register';
import { registerRequestId } from '@/plugins/request-id/register';
import { registerSecurityHeaders } from '@/plugins/security-headers/register';

export const registerPlugins = async (app: FastifyInstance): Promise<void> => {
  registerSecurityHeaders(app);
  registerRequestId(app);
  registerMetrics(app);
  registerErrorHandler(app);
  await registerCors(app);
  await registerFormBody(app);
  await registerGlobalRateLimit(app);
};
