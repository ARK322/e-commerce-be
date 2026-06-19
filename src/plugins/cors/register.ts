import cors from '@fastify/cors';
import { FastifyInstance } from 'fastify';
import { env } from '@/config/env';
import { CORS_ALLOWED_METHODS } from '@/config/constants';

export const getAllowedOrigins = (): string[] => env.allowedOrigins;

export const corsOriginHandler = (
  origin: string | undefined,
  callback: (err: Error | null, allow: boolean) => void
): void => {
  const allowed = getAllowedOrigins();

  if (!origin || allowed.includes(origin)) {
    callback(null, true);
    return;
  }

  callback(null, false);
};

export const registerCors = async (app: FastifyInstance): Promise<void> => {
  await app.register(cors, {
    origin: corsOriginHandler,
    methods: [...CORS_ALLOWED_METHODS],
  });
};
