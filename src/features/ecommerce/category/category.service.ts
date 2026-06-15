import { Category, Product } from '@/db';
import { createUserId } from '@/lib/common/user-id';
import { EcommerceError } from '@/features/ecommerce/core/errors';
import {
  buildCategoryTree,
  collectDescendantIds,
  filterCategoriesWithActiveAncestors,
  isDescendantOf,
} from '@/features/ecommerce/category/category-tree';
import { slugify } from '@/features/ecommerce/category/slugify';
import type { CreateCategoryInput } from '@/features/ecommerce/category/create-category.schema';
import type { UpdateCategoryInput } from '@/features/ecommerce/category/update-category.schema';

type CategoryRecord = {
  _id: unknown;
  parentId?: string | null;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt?: Date;
};

const normalizeParentId = (parentId: string | null | undefined): string | null =>
  parentId ?? null;

const toCategoryLink = (category: CategoryRecord) => ({
  id: String(category._id),
  parentId: normalizeParentId(category.parentId),
});

const toCategoryResponse = (category: CategoryRecord) => ({
  id: String(category._id),
  parentId: normalizeParentId(category.parentId),
  name: category.name,
  slug: category.slug,
  isActive: category.isActive,
  createdAt: category.createdAt,
});

const toPublicCategoryResponse = (category: CategoryRecord) => ({
  id: String(category._id),
  parentId: normalizeParentId(category.parentId),
  name: category.name,
  slug: category.slug,
});

const resolveSlug = (name: string, slug?: string) => {
  const resolved = slug ?? slugify(name);

  if (!resolved) {
    throw new EcommerceError(400, 'Geçerli bir slug üretilemedi');
  }

  return resolved;
};

const loadAllCategoryLinks = async () => {
  const categories = await Category.find().select('_id parentId isActive').lean();

  return categories.map((category) => ({
    ...toCategoryLink(category),
    isActive: category.isActive,
  }));
};

const assertValidParentId = async (
  parentId: string | null,
  categoryId?: string
) => {
  if (!parentId) {
    return;
  }

  if (categoryId && parentId === categoryId) {
    throw new EcommerceError(400, 'Kategori kendi alt kategorisi olamaz');
  }

  const parent = await Category.findById(parentId).lean();

  if (!parent) {
    throw new EcommerceError(400, 'Üst kategori bulunamadı');
  }

  if (categoryId) {
    const links = await loadAllCategoryLinks();

    if (isDescendantOf(parentId, categoryId, links)) {
      throw new EcommerceError(400, 'Kategori kendi alt ağacına taşınamaz');
    }
  }
};

export const getCategoryDescendantIds = async (categoryId: string) => {
  const category = await Category.findById(categoryId).select('_id').lean();

  if (!category) {
    throw new EcommerceError(404, 'Kategori bulunamadı');
  }

  const links = await loadAllCategoryLinks();

  return [categoryId, ...collectDescendantIds(categoryId, links)];
};

export const listPublicCategories = async () => {
  const categories = await Category.find({ isActive: true }).lean();

  const visibleCategories = filterCategoriesWithActiveAncestors(
    categories.map((category) => ({
      ...toCategoryLink(category),
      isActive: category.isActive,
    }))
  );

  const visibleIds = new Set(visibleCategories.map((category) => category.id));
  const flatCategories = categories
    .filter((category) => visibleIds.has(String(category._id)))
    .map(toPublicCategoryResponse);

  return buildCategoryTree(flatCategories, (category) => category);
};

export const listAdminCategories = async () => {
  const categories = await Category.find().lean();
  const flatCategories = categories.map(toCategoryResponse);

  return buildCategoryTree(flatCategories, (category) => category);
};

export const getCategoryById = async (categoryId: string) => {
  const category = await Category.findById(categoryId).lean();

  if (!category) {
    throw new EcommerceError(404, 'Kategori bulunamadı');
  }

  const links = await loadAllCategoryLinks();
  const childCount = links.filter((link) => link.parentId === categoryId).length;

  return {
    ...toCategoryResponse(category),
    childCount,
  };
};

export const createCategory = async (input: CreateCategoryInput) => {
  const slug = resolveSlug(input.name, input.slug);
  const parentId = normalizeParentId(input.parentId);

  await assertValidParentId(parentId);

  const category = await Category.create({
    _id: createUserId(),
    parentId,
    name: input.name,
    slug,
    isActive: input.isActive ?? true,
  });

  return toCategoryResponse(category.toObject());
};

export const updateCategory = async (categoryId: string, input: UpdateCategoryInput) => {
  const category = await Category.findById(categoryId);

  if (!category) {
    throw new EcommerceError(404, 'Kategori bulunamadı');
  }

  if (input.parentId !== undefined) {
    const parentId = normalizeParentId(input.parentId);
    await assertValidParentId(parentId, categoryId);
    category.parentId = parentId;
  }

  if (input.name !== undefined) {
    category.name = input.name;
  }

  if (input.slug !== undefined) {
    category.slug = input.slug;
  } else if (input.name !== undefined) {
    category.slug = resolveSlug(input.name);
  }

  if (input.isActive !== undefined) {
    category.isActive = input.isActive;
  }

  await category.save();

  return toCategoryResponse(category.toObject());
};

export const deleteCategory = async (categoryId: string) => {
  const category = await Category.findById(categoryId);

  if (!category) {
    throw new EcommerceError(404, 'Kategori bulunamadı');
  }

  const childCount = await Category.countDocuments({ parentId: categoryId });

  if (childCount > 0) {
    throw new EcommerceError(409, 'Alt kategori bulunduğu için silinemez');
  }

  const productCount = await Product.countDocuments({ categoryIds: categoryId });

  if (productCount > 0) {
    throw new EcommerceError(409, 'Bu kategoride ürün bulunduğu için silinemez');
  }

  await Category.findByIdAndDelete(categoryId);
};
