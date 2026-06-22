import { catalogCacheKeys } from '@/domains/catalog/infrastructure/cache/catalog-keys';
import { getCatalogCacheStore } from '@/domains/catalog/infrastructure/cache/catalog-cache-store';
import { invalidateVisibleCategoryIdsCache } from '@/domains/catalog/application/category/visible-categories';

export const invalidateCatalogCache = async (): Promise<void> => {
  const store = getCatalogCacheStore();
  await store.deleteByPrefix(catalogCacheKeys.categoriesPrefix());
  await store.deleteByPrefix(catalogCacheKeys.productsPrefix());
  await invalidateVisibleCategoryIdsCache();
};

export const invalidateCatalogProductCache = async (): Promise<void> => {
  await getCatalogCacheStore().deleteByPrefix(catalogCacheKeys.productsPrefix());
};

export const invalidateCatalogProductDetail = async (productId: string): Promise<void> => {
  await getCatalogCacheStore().delete(catalogCacheKeys.productDetail(productId));
};

export const invalidateCatalogProductStock = async (productIds: string[]): Promise<void> => {
  await Promise.all(productIds.map((productId) => invalidateCatalogProductDetail(productId)));
};
