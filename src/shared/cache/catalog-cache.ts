import { catalogCacheKeys } from '@/shared/cache/catalog-keys';
import { memoryCache } from '@/shared/cache/memory-cache';
import { invalidateVisibleCategoryIdsCache } from '@/domain/catalog/category/visible-categories';

export const invalidateCatalogCache = (): void => {
  memoryCache.deleteByPrefix(catalogCacheKeys.categoriesPrefix());
  memoryCache.deleteByPrefix(catalogCacheKeys.productsPrefix());
  invalidateVisibleCategoryIdsCache();
};

export const invalidateCatalogProductCache = (): void => {
  memoryCache.deleteByPrefix(catalogCacheKeys.productsPrefix());
};

export const invalidateCatalogProductDetail = (productId: string): void => {
  memoryCache.delete(catalogCacheKeys.productDetail(productId));
};

export const invalidateCatalogProductStock = (productIds: string[]): void => {
  for (const productId of productIds) {
    invalidateCatalogProductDetail(productId);
  }
};
