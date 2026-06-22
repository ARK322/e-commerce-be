import { collectLeafIdsInSubtree } from '@/domain/catalog/category/category-graph';
import { loadCategoryGraphNodes } from '@/domain/catalog/category/load-category-graph';
import { CommerceError } from '@/shared/errors/commerce-error';
import { findCategoryByIdSelectLean } from '@/repositories/catalog/category.repository';

export const getCategoryProductFilterIds = async (categoryId: string) => {
  const category = await findCategoryByIdSelectLean(categoryId, '_id');

  if (!category) {
    throw new CommerceError(404, 'Kategori bulunamadı');
  }

  const graphNodes = await loadCategoryGraphNodes();

  return collectLeafIdsInSubtree(categoryId, graphNodes);
};
