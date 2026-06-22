import { CommerceError } from '@/shared/errors/commerce-error';
import {
  findActiveCategoriesLean,
  findCategoryByIdLean,
  findCategoryByIdSelectLean,
} from '@/repositories/catalog/category.repository';
import {
  buildCategoryForest,
  collectAncestorPaths,
  collectDescendantIds,
  filterCategoriesWithActiveAncestors,
} from '@/domain/catalog/category/category-graph';
import { loadCategoryGraphNodes } from '@/domain/catalog/category/load-category-graph';
import { isCategoryPubliclyVisible } from '@/domain/catalog/category/visible-categories';
import { catalogCacheKeys } from '@/shared/cache/catalog-keys';
import { catalogCacheConfig } from '@/shared/cache/catalog-cache-config';
import { memoryCache } from '@/shared/cache/memory-cache';
import {
  toGraphNode,
  toPublicCategoryResponse,
  type CategoryRecord,
} from '@/domain/catalog/category/category-helpers';

const listPublicCategoriesUncached = async () => {
  const categories = await findActiveCategoriesLean();
  const graphNodes = categories.map((category) => toGraphNode(category as CategoryRecord));
  const visibleNodes = filterCategoriesWithActiveAncestors(graphNodes);
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const flatCategories = categories
    .filter((category) => visibleIds.has(String(category._id)))
    .map((category) => toPublicCategoryResponse(category as CategoryRecord));

  return buildCategoryForest(flatCategories, (category) => category);
};

export const listPublicCategories = async () => {
  if (!catalogCacheConfig.enabled) {
    return listPublicCategoriesUncached();
  }

  const cacheKey = catalogCacheKeys.publicCategories();
  const cached = memoryCache.get<Awaited<ReturnType<typeof listPublicCategoriesUncached>>>(cacheKey);

  if (cached) {
    return cached;
  }

  const categories = await listPublicCategoriesUncached();
  memoryCache.set(cacheKey, categories, { ttlMs: catalogCacheConfig.categoriesTtlMs });

  return categories;
};

export const getCategoryDescendantIds = async (categoryId: string) => {
  const category = await findCategoryByIdSelectLean(categoryId, '_id');

  if (!category) {
    throw new CommerceError(404, 'Kategori bulunamadı');
  }

  const graphNodes = await loadCategoryGraphNodes();

  return [categoryId, ...collectDescendantIds(categoryId, graphNodes)];
};

export const getCategoryPaths = async (categoryId: string) => {
  const category = await findCategoryByIdLean(categoryId);

  if (!category) {
    throw new CommerceError(404, 'Kategori bulunamadı');
  }

  const graphNodes = await loadCategoryGraphNodes();
  const visibleNodes = filterCategoriesWithActiveAncestors(graphNodes);
  const isVisible = visibleNodes.some((node) => node.id === categoryId);

  if (!isVisible) {
    throw new CommerceError(404, 'Kategori bulunamadı');
  }

  return collectAncestorPaths(categoryId, graphNodes);
};

export const getPublicCategoryById = async (categoryId: string) => {
  const category = await findCategoryByIdLean(categoryId);

  if (!category || !category.isActive) {
    throw new CommerceError(404, 'Kategori bulunamadı');
  }

  const visible = await isCategoryPubliclyVisible(categoryId);

  if (!visible) {
    throw new CommerceError(404, 'Kategori bulunamadı');
  }

  const paths = await getCategoryPaths(categoryId);

  return {
    ...toPublicCategoryResponse(category as CategoryRecord),
    paths,
  };
};
