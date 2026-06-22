import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearMemoryCache } from '@/shared/cache/memory-cache';
import {
  invalidateCatalogProductDetail,
  invalidateCatalogProductStock,
} from '@/shared/cache/catalog-cache';
import { catalogCacheKeys } from '@/shared/cache/catalog-keys';
import { memoryCache } from '@/shared/cache/memory-cache';

describe('catalog-cache invalidation', () => {
  afterEach(() => {
    clearMemoryCache();
  });

  it('stok invalidation yalnızca ilgili ürün detayını siler', () => {
    const productA = 'prod-a';
    const productB = 'prod-b';

    memoryCache.set(catalogCacheKeys.productDetail(productA), { id: productA }, { ttlMs: 60_000 });
    memoryCache.set(catalogCacheKeys.productDetail(productB), { id: productB }, { ttlMs: 60_000 });
    memoryCache.set(catalogCacheKeys.productsList({ page: 1, limit: 20 }), { products: [] }, {
      ttlMs: 60_000,
    });

    invalidateCatalogProductStock([productA]);

    expect(memoryCache.get(catalogCacheKeys.productDetail(productA))).toBeUndefined();
    expect(memoryCache.get(catalogCacheKeys.productDetail(productB))).toEqual({ id: productB });
    expect(
      memoryCache.get(catalogCacheKeys.productsList({ page: 1, limit: 20 }))
    ).toEqual({ products: [] });
  });

  it('invalidateCatalogProductDetail tek ürün detayını siler', () => {
    memoryCache.set(catalogCacheKeys.productDetail('prod-x'), { id: 'prod-x' }, { ttlMs: 60_000 });

    invalidateCatalogProductDetail('prod-x');

    expect(memoryCache.get(catalogCacheKeys.productDetail('prod-x'))).toBeUndefined();
  });
});

describe('catalog cache env', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('CATALOG_CACHE_ENABLED=false iken cache kapalı', async () => {
    vi.stubEnv('CATALOG_CACHE_ENABLED', 'false');

    const { catalogCacheConfig } = await import('@/shared/cache/catalog-cache-config');

    expect(catalogCacheConfig.enabled).toBe(false);
  });
});
