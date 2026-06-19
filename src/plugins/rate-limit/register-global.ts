import rateLimit from '@fastify/rate-limit';
import { FastifyInstance } from 'fastify';
import { GLOBAL_RATE_LIMIT } from '@/middleware/presets/rate-limit';

export const registerGlobalRateLimit = async (app: FastifyInstance): Promise<void> => {
  await app.register(rateLimit, {
    global: true,
    ...GLOBAL_RATE_LIMIT,
  });
};
