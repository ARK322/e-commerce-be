import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearMemoryCache } from '@/domains/catalog/infrastructure/cache/memory-cache';
import {
  invalidateCatalogProductDetail,
  invalidateCatalogProductStock,
} from '@/domains/catalog/infrastructure/cache/catalog-cache';
import { catalogCacheKeys } from '@/domains/catalog/infrastructure/cache/catalog-keys';
import { memoryCache } from '@/domains/catalog/infrastructure/cache/memory-cache';

describe('catalog-cache invalidation', () => {
  afterEach(() => {
    clearMemoryCache();
  });

  it('stok invalidation yalnızca ilgili ürün detayını siler', async () => {
    const productA = 'prod-a';
    const productB = 'prod-b';

    memoryCache.set(catalogCacheKeys.productDetail(productA), { id: productA }, { ttlMs: 60_000 });
    memoryCache.set(catalogCacheKeys.productDetail(productB), { id: productB }, { ttlMs: 60_000 });
    memoryCache.set(catalogCacheKeys.productsList({ page: 1, limit: 20 }), { products: [] }, {
      ttlMs: 60_000,
    });

    await invalidateCatalogProductStock([productA]);

    expect(memoryCache.get(catalogCacheKeys.productDetail(productA))).toBeUndefined();
    expect(memoryCache.get(catalogCacheKeys.productDetail(productB))).toEqual({ id: productB });
    expect(
      memoryCache.get(catalogCacheKeys.productsList({ page: 1, limit: 20 }))
    ).toEqual({ products: [] });
  });

  it('invalidateCatalogProductDetail tek ürün detayını siler', async () => {
    memoryCache.set(catalogCacheKeys.productDetail('prod-x'), { id: 'prod-x' }, { ttlMs: 60_000 });

    await invalidateCatalogProductDetail('prod-x');

    expect(memoryCache.get(catalogCacheKeys.productDetail('prod-x'))).toBeUndefined();
  });
});

describe('catalog cache env', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('CATALOG_CACHE_ENABLED=false iken cache kapalı', async () => {
    vi.stubEnv('CATALOG_CACHE_ENABLED', 'false');

    const { catalogCacheConfig } = await import('@/domains/catalog/infrastructure/cache/catalog-cache-config');

    expect(catalogCacheConfig.enabled).toBe(false);
  });
});
