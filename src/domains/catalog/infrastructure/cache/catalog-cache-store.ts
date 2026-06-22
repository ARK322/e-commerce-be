import { env } from '@/config/env';
import { memoryCache, type MemoryCacheSetOptions } from '@/domains/catalog/infrastructure/cache/memory-cache';

/**
 * Catalog cache store soyutlamas\u0131.
 *
 * Faz 2 hedefi: catalog servisi birden fazla pod'da \u00e7al\u0131\u015facak \u2014 in-memory cache
 * pod'lar aras\u0131 tutars\u0131z. Bu interface, hot-path async'e \u00e7evrildi\u011finde Redis
 * backend'inin sorunsuz tak\u0131lmas\u0131 i\u00e7in s\u00f6zle\u015fmeyi sabitler.
 *
 * NOT: Mevcut public-products/public-categories okuma yollar\u0131 senkron
 * `memoryCache.get()` kullan\u0131yor. Redis (async) devreye al\u0131nmadan \u00f6nce o
 * \u00e7a\u011fr\u0131lar bu async store'a ge\u00e7irilmeli (Faz 2 kalan i\u015f).
 */
export interface CatalogCacheStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, options: MemoryCacheSetOptions): Promise<void>;
  delete(key: string): Promise<void>;
  deleteByPrefix(prefix: string): Promise<void>;
}

class MemoryCatalogCacheStore implements CatalogCacheStore {
  async get<T>(key: string): Promise<T | undefined> {
    return memoryCache.get<T>(key);
  }

  async set<T>(key: string, value: T, options: MemoryCacheSetOptions): Promise<void> {
    memoryCache.set(key, value, options);
  }

  async delete(key: string): Promise<void> {
    memoryCache.delete(key);
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    memoryCache.deleteByPrefix(prefix);
  }
}

class RedisCatalogCacheStore implements CatalogCacheStore {
  private async redis() {
    const { getRedis } = await import('@/integrations/redis/redis');
    return getRedis();
  }

  async get<T>(key: string): Promise<T | undefined> {
    const redis = await this.redis();
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  }

  async set<T>(key: string, value: T, options: MemoryCacheSetOptions): Promise<void> {
    const redis = await this.redis();
    await redis.set(key, JSON.stringify(value), 'PX', options.ttlMs);
  }

  async delete(key: string): Promise<void> {
    const redis = await this.redis();
    await redis.del(key);
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    const redis = await this.redis();
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

let store: CatalogCacheStore | null = null;

export const getCatalogCacheStore = (): CatalogCacheStore => {
  if (store) {
    return store;
  }

  store = env.catalogCacheBackend === 'redis'
    ? new RedisCatalogCacheStore()
    : new MemoryCatalogCacheStore();

  return store;
};
