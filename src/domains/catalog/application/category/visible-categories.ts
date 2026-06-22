import { findAllCategoryGraphNodesLean } from '@/domains/catalog/infrastructure/repositories/category.repository';
import {
  filterCategoriesWithActiveAncestors,
  type CategoryGraphNode,
} from '@/domains/catalog/application/category/category-graph';
import { catalogCacheConfig } from '@/domains/catalog/infrastructure/cache/catalog-cache-config';
import { catalogCacheKeys } from '@/domains/catalog/infrastructure/cache/catalog-keys';
import { getCatalogCacheStore } from '@/domains/catalog/infrastructure/cache/catalog-cache-store';

const toGraphNode = (category: {
  _id: unknown;
  parentIds?: string[];
  childIds?: string[];
  isActive: boolean;
  isLeaf?: boolean;
}): CategoryGraphNode => ({
  id: String(category._id),
  parentIds: category.parentIds ?? [],
  childIds: category.childIds ?? [],
  isActive: category.isActive,
  isLeaf: category.isLeaf,
});

const loadVisibleCategoryIds = async (): Promise<Set<string>> => {
  const categories = await findAllCategoryGraphNodesLean();

  const nodes = categories.map(toGraphNode);
  const visible = filterCategoriesWithActiveAncestors(nodes);

  return new Set(visible.map((node) => node.id));
};

export const getPublicVisibleCategoryIds = async (): Promise<Set<string>> => {
  if (!catalogCacheConfig.enabled) {
    return loadVisibleCategoryIds();
  }

  const store = getCatalogCacheStore();
  const cacheKey = catalogCacheKeys.visibleCategoryIds();
  const cached = await store.get<string[]>(cacheKey);

  if (cached) {
    return new Set(cached);
  }

  const ids = await loadVisibleCategoryIds();
  await store.set(cacheKey, [...ids], { ttlMs: catalogCacheConfig.visibleCategoriesTtlMs });

  return ids;
};

export const invalidateVisibleCategoryIdsCache = async (): Promise<void> => {
  await getCatalogCacheStore().delete(catalogCacheKeys.visibleCategoryIds());
};

export const isCategoryPubliclyVisible = async (categoryId: string): Promise<boolean> => {
  const visibleIds = await getPublicVisibleCategoryIds();
  return visibleIds.has(categoryId);
};
