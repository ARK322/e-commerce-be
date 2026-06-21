import { CommerceError } from '@/internal/common/errors/commerce-error';
import {
  findCategoryById,
  saveCategoryDocument,
} from '@/repositories/catalog/category.repository';
import { clearProductsInCategory } from '@/repositories/catalog/product.repository';
import {
  MAX_CHILDREN_PER_NODE,
  MAX_PARENTS_PER_NODE,
  uniqueIds,
  wouldCreateCycle,
} from '@/internal/catalog/category/category-graph';
import { loadCategoryGraphNodes } from '@/internal/catalog/category/load-category-graph';
import {
  assertCategoryExists,
  normalizeIds,
  refreshLeafFlag,
} from '@/internal/catalog/category/category-helpers';

export const addCategoryLink = async (parentId: string, childId: string) => {
  if (parentId === childId) {
    throw new CommerceError(400, 'Kategori kendine bağlanamaz');
  }

  const [parent, child] = await Promise.all([
    findCategoryById(parentId),
    findCategoryById(childId),
  ]);

  if (!parent) {
    throw new CommerceError(400, 'Üst kategori bulunamadı');
  }

  if (!child) {
    throw new CommerceError(400, 'Alt kategori bulunamadı');
  }

  const parentIds = normalizeIds(child.parentIds);
  const childIds = normalizeIds(parent.childIds);

  if (parentIds.includes(parentId) && childIds.includes(childId)) {
    return { orphanedProductCount: 0 };
  }

  const graphNodes = await loadCategoryGraphNodes();

  if (wouldCreateCycle(parentId, childId, graphNodes)) {
    throw new CommerceError(400, 'Bu bağlantı döngü oluşturur');
  }

  if (parentIds.length >= MAX_PARENTS_PER_NODE) {
    throw new CommerceError(400, `En fazla ${MAX_PARENTS_PER_NODE} üst kategori bağlanabilir`);
  }

  if (childIds.length >= MAX_CHILDREN_PER_NODE) {
    throw new CommerceError(400, `En fazla ${MAX_CHILDREN_PER_NODE} alt kategori bağlanabilir`);
  }

  const parentWasLeaf = childIds.length === 0;

  child.parentIds = uniqueIds([...parentIds, parentId]);
  parent.childIds = uniqueIds([...childIds, childId]);
  parent.isLeaf = false;

  let orphanedProductCount = 0;

  if (parentWasLeaf) {
    const result = await clearProductsInCategory(parentId);
    orphanedProductCount = result.modifiedCount;
  }

  await Promise.all([saveCategoryDocument(parent), saveCategoryDocument(child), refreshLeafFlag(childId)]);

  return { orphanedProductCount };
};

export const removeCategoryLink = async (parentId: string, childId: string) => {
  const [parent, child] = await Promise.all([
    findCategoryById(parentId),
    findCategoryById(childId),
  ]);

  if (!parent || !child) {
    throw new CommerceError(404, 'Kategori bulunamadı');
  }

  parent.childIds = normalizeIds(parent.childIds).filter((id) => id !== childId);
  child.parentIds = normalizeIds(child.parentIds).filter((id) => id !== parentId);

  await Promise.all([
    saveCategoryDocument(parent),
    saveCategoryDocument(child),
    refreshLeafFlag(parentId),
    refreshLeafFlag(childId),
  ]);
};

export { assertCategoryExists };
