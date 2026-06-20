import { Category } from '@/integrations/mongo';
import {
  filterCategoriesWithActiveAncestors,
  type CategoryGraphNode,
} from '@/internal/catalog/category/category-graph';

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

let cachedVisibleIds: { ids: Set<string>; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

export const getPublicVisibleCategoryIds = async (): Promise<Set<string>> => {
  if (cachedVisibleIds && cachedVisibleIds.expiresAt > Date.now()) {
    return cachedVisibleIds.ids;
  }

  const categories = await Category.find()
    .select('_id parentIds childIds isActive isLeaf')
    .lean();

  const nodes = categories.map(toGraphNode);
  const visible = filterCategoriesWithActiveAncestors(nodes);
  const ids = new Set(visible.map((node) => node.id));

  cachedVisibleIds = { ids, expiresAt: Date.now() + CACHE_TTL_MS };

  return ids;
};

export const invalidateVisibleCategoryIdsCache = (): void => {
  cachedVisibleIds = null;
};

export const isCategoryPubliclyVisible = async (categoryId: string): Promise<boolean> => {
  const visibleIds = await getPublicVisibleCategoryIds();
  return visibleIds.has(categoryId);
};
