import { findAllCategoryGraphNodesLean } from '@/repositories/catalog/category.repository';
import {
  filterCategoriesWithActiveAncestors,
  type CategoryGraphNode,
} from '@/domain/catalog/category/category-graph';
import { catalogCacheConfig } from '@/shared/cache/catalog-cache-config';
import { catalogCacheKeys } from '@/shared/cache/catalog-keys';
import { memoryCache } from '@/shared/cache/memory-cache';

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

  const cacheKey = catalogCacheKeys.visibleCategoryIds();
  const cached = memoryCache.get<string[]>(cacheKey);

  if (cached) {
    return new Set(cached);
  }

  const ids = await loadVisibleCategoryIds();
  memoryCache.set(cacheKey, [...ids], { ttlMs: catalogCacheConfig.visibleCategoriesTtlMs });

  return ids;
};

export const invalidateVisibleCategoryIdsCache = (): void => {
  memoryCache.delete(catalogCacheKeys.visibleCategoryIds());
};

export const isCategoryPubliclyVisible = async (categoryId: string): Promise<boolean> => {
  const visibleIds = await getPublicVisibleCategoryIds();
  return visibleIds.has(categoryId);
};
