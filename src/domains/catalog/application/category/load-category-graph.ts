import { uniqueIds, type CategoryGraphNode } from '@/domains/catalog/application/category/category-graph';
import { findAllCategoryGraphNodesLean } from '@/domains/catalog/infrastructure/repositories/category.repository';

type CategoryGraphRecord = {
  _id: unknown;
  parentIds?: string[];
  childIds?: string[];
  isActive: boolean;
  isLeaf?: boolean;
};

const toGraphNode = (category: CategoryGraphRecord): CategoryGraphNode => ({
  id: String(category._id),
  parentIds: uniqueIds(category.parentIds ?? []),
  childIds: uniqueIds(category.childIds ?? []),
  isActive: category.isActive,
  isLeaf: category.isLeaf ?? uniqueIds(category.childIds ?? []).length === 0,
});

export const loadCategoryGraphNodes = async (): Promise<CategoryGraphNode[]> => {
  const categories = await findAllCategoryGraphNodesLean();

  return categories.map(toGraphNode);
};
