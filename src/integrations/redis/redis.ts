import type { Redis } from 'ioredis';
import { env } from '@/config/env';
import { createLogger } from '@/shared/logging';

const log = createLogger({ module: 'redis' });

let client: Redis | null = null;

/**
 * Lazy connect — sadece REDIS_URL tan\u0131ml\u0131yken ve \u00e7a\u011fr\u0131ld\u0131\u011f\u0131nda kurulur.
 * Monolith/test modunda (REDIS_URL yok) tetiklenmez.
 */
export const getRedis = async (): Promise<Redis> => {
  if (client) {
    return client;
  }

  const url = env.redisUrl;

  if (!url) {
    throw new Error('REDIS_URL tan\u0131ml\u0131 de\u011fil');
  }

  const { default: IORedis } = await import('ioredis');
  client = new IORedis(url, { maxRetriesPerRequest: 3, lazyConnect: false });

  client.on('error', (err) => {
    log.error({ err }, 'Redis hatas\u0131');
  });

  log.info('Redis ba\u011flant\u0131s\u0131 haz\u0131r');
  return client;
};

export const closeRedis = async (): Promise<void> => {
  await client?.quit().catch(() => undefined);
  client = null;
};
