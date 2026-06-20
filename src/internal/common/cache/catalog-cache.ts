import { catalogCacheKeys } from '@/internal/common/cache/catalog-keys';
import { memoryCache } from '@/internal/common/cache/memory-cache';
import { invalidateVisibleCategoryIdsCache } from '@/internal/catalog/category/visible-categories';

export const invalidateCatalogCache = (): void => {
  memoryCache.deleteByPrefix(catalogCacheKeys.categoriesPrefix());
  memoryCache.deleteByPrefix(catalogCacheKeys.productsPrefix());
  invalidateVisibleCategoryIdsCache();
};

export const invalidateCatalogProductCache = (): void => {
  memoryCache.deleteByPrefix(catalogCacheKeys.productsPrefix());
  invalidateVisibleCategoryIdsCache();
};
