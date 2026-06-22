import { collectLeafIdsInSubtree } from '@/domains/catalog/application/category/category-graph';
import { loadCategoryGraphNodes } from '@/domains/catalog/application/category/load-category-graph';
import { CommerceError } from '@/shared/errors/commerce-error';
import { findCategoryByIdSelectLean } from '@/domains/catalog/infrastructure/repositories/category.repository';

export const getCategoryProductFilterIds = async (categoryId: string) => {
  const category = await findCategoryByIdSelectLean(categoryId, '_id');

  if (!category) {
    throw new CommerceError(404, 'Kategori bulunamadı');
  }

  const graphNodes = await loadCategoryGraphNodes();

  return collectLeafIdsInSubtree(categoryId, graphNodes);
};
