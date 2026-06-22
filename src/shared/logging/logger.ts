import pino from 'pino';
import { env } from '@/config/env';

export const logger = pino({
  level: env.logLevel,
});

export const createLogger = (context: Record<string, unknown>) => logger.child(context);
