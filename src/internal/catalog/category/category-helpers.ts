import { CommerceError } from '@/internal/common/errors/commerce-error';
import {
  findCategoryById,
  findCategoryByIdSelectLean,
  saveCategoryDocument,
} from '@/repositories/catalog/category.repository';
import { uniqueIds, type CategoryGraphNode } from '@/internal/catalog/category/category-graph';
import { slugify } from '@/internal/catalog/category/slugify';

export type CategoryRecord = {
  _id: unknown;
  parentIds?: string[];
  childIds?: string[];
  name: string;
  slug: string;
  isActive: boolean;
  isLeaf?: boolean;
  createdAt?: Date;
};

export const normalizeIds = (ids: string[] | undefined) => uniqueIds(ids ?? []);

export const toGraphNode = (category: CategoryRecord): CategoryGraphNode => ({
  id: String(category._id),
  parentIds: normalizeIds(category.parentIds),
  childIds: normalizeIds(category.childIds),
  isActive: category.isActive,
  isLeaf: category.isLeaf ?? normalizeIds(category.childIds).length === 0,
});

export const toCategoryResponse = (category: CategoryRecord) => ({
  id: String(category._id),
  parentIds: normalizeIds(category.parentIds),
  childIds: normalizeIds(category.childIds),
  name: category.name,
  slug: category.slug,
  isActive: category.isActive,
  isLeaf: category.isLeaf ?? normalizeIds(category.childIds).length === 0,
  createdAt: category.createdAt,
});

export const toPublicCategoryResponse = (category: CategoryRecord) => ({
  id: String(category._id),
  parentIds: normalizeIds(category.parentIds),
  childIds: normalizeIds(category.childIds),
  name: category.name,
  slug: category.slug,
  isLeaf: category.isLeaf ?? normalizeIds(category.childIds).length === 0,
});

export const resolveSlug = (name: string, slug?: string) => {
  const resolved = slug ?? slugify(name);

  if (!resolved) {
    throw new CommerceError(400, 'Geçerli bir slug üretilemedi');
  }

  return resolved;
};

export const refreshLeafFlag = async (categoryId: string) => {
  const category = await findCategoryById(categoryId);

  if (!category) {
    return;
  }

  category.isLeaf = normalizeIds(category.childIds).length === 0;
  await saveCategoryDocument(category);
};

export const assertCategoryExists = async (categoryId: string, label: string) => {
  const category = await findCategoryByIdSelectLean(categoryId, '_id');

  if (!category) {
    throw new CommerceError(400, `${label} bulunamadı`);
  }
};
