import { uniqueIds } from '@/domain/catalog/category/category-graph';
import { CommerceError } from '@/shared/errors/commerce-error';
import { findCategoryByIdSelectLean } from '@/repositories/catalog/category.repository';

export const assertProductCategory = async (categoryId: string) => {
  const category = await findCategoryByIdSelectLean(categoryId, '_id isActive isLeaf childIds');

  if (!category || !category.isActive) {
    throw new CommerceError(400, 'Geçersiz kategori');
  }

  const isLeaf = category.isLeaf ?? uniqueIds(category.childIds).length === 0;

  if (!isLeaf) {
    throw new CommerceError(400, 'Ürün yalnızca alt kategoriye eklenebilir');
  }
};
