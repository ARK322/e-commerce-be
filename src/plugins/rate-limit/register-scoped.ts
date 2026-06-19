import rateLimit from '@fastify/rate-limit';
import { FastifyInstance } from 'fastify';
import type { RateLimitPreset } from '@/middleware/presets/rate-limit';

export const registerScopedRateLimit = async (
  app: FastifyInstance,
  preset: RateLimitPreset
): Promise<void> => {
  await app.register(rateLimit, preset);
};
