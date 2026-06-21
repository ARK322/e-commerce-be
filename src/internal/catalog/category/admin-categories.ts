import { createUserId } from '@/internal/common/ids';
import { CommerceError } from '@/internal/common/errors/commerce-error';
import {
  createCategory as createCategoryRecord,
  deleteCategoryById,
  findAllCategoriesLean,
  findCategoryById,
  findCategoryByIdLean,
  saveCategoryDocument,
  updateCategoriesByIds,
} from '@/repositories/catalog/category.repository';
import {
  countProductsInCategory,
  deactivateProductsInCategories,
} from '@/repositories/catalog/product.repository';
import {
  buildCategoryForest,
  collectDescendantIds,
  uniqueIds,
} from '@/internal/catalog/category/category-graph';
import { loadCategoryGraphNodes } from '@/internal/catalog/category/load-category-graph';
import type {
  CreateCategoryInput,
  LinkCategoryInput,
  UpdateCategoryInput,
} from '@/internal/catalog/category/category-admin.schema';
import { invalidateCatalogCache } from '@/internal/common/cache/catalog-cache';
import {
  assertCategoryExists,
  normalizeIds,
  resolveSlug,
  toCategoryResponse,
  type CategoryRecord,
} from '@/internal/catalog/category/category-helpers';
import {
  addCategoryLink,
  removeCategoryLink,
} from '@/internal/catalog/category/category-links';
import { getCategoryPaths } from '@/internal/catalog/category/public-categories';

export const listAdminCategories = async () => {
  const categories = await findAllCategoriesLean();
  const flatCategories = categories.map((category) => toCategoryResponse(category as CategoryRecord));

  return buildCategoryForest(flatCategories, (category) => category);
};

export const getCategoryById = async (categoryId: string) => {
  const category = await findCategoryByIdLean(categoryId);

  if (!category) {
    throw new CommerceError(404, 'Kategori bulunamadı');
  }

  const paths = await getCategoryPaths(categoryId);

  return {
    ...toCategoryResponse(category as CategoryRecord),
    paths,
  };
};

export const createCategory = async (input: CreateCategoryInput) => {
  const slug = resolveSlug(input.name, input.slug);
  const parentIds = uniqueIds(input.parentIds ?? []);

  for (const parentId of parentIds) {
    await assertCategoryExists(parentId, 'Üst kategori');
  }

  const categoryId = createUserId();

  await createCategoryRecord({
    _id: categoryId,
    parentIds: [],
    childIds: [],
    name: input.name,
    slug,
    isActive: input.isActive ?? true,
    isLeaf: true,
  });

  for (const parentId of parentIds) {
    await addCategoryLink(parentId, categoryId);
  }

  const fresh = await findCategoryByIdLean(categoryId);

  invalidateCatalogCache();

  return toCategoryResponse(fresh! as CategoryRecord);
};

export const updateCategory = async (categoryId: string, input: UpdateCategoryInput) => {
  const category = await findCategoryById(categoryId);

  if (!category) {
    throw new CommerceError(404, 'Kategori bulunamadı');
  }

  if (input.name !== undefined) {
    category.name = input.name;
  }

  if (input.slug !== undefined) {
    category.slug = input.slug;
  } else if (input.name !== undefined) {
    category.slug = resolveSlug(input.name);
  }

  if (input.isActive === false && category.isActive !== false) {
    const graphNodes = await loadCategoryGraphNodes();
    const descendants = collectDescendantIds(categoryId, graphNodes);
    const categoryIdsToDeactivate = [categoryId, ...descendants];

    await updateCategoriesByIds(categoryIdsToDeactivate, { isActive: false });
    await deactivateProductsInCategories(categoryIdsToDeactivate);

    category.isActive = false;
  } else if (input.isActive !== undefined) {
    category.isActive = input.isActive;
  }

  await saveCategoryDocument(category);

  invalidateCatalogCache();

  return toCategoryResponse(category.toObject() as CategoryRecord);
};

export const linkCategory = async (categoryId: string, input: LinkCategoryInput) => {
  await assertCategoryExists(categoryId, 'Kategori');

  let orphanedProductCount = 0;

  if (input.parentId) {
    const result = await addCategoryLink(input.parentId, categoryId);
    orphanedProductCount += result.orphanedProductCount;
  }

  if (input.childId) {
    const result = await addCategoryLink(categoryId, input.childId);
    orphanedProductCount += result.orphanedProductCount;
  }

  const category = await findCategoryByIdLean(categoryId);

  invalidateCatalogCache();

  return {
    message:
      orphanedProductCount > 0
        ? 'Kategori bağlantısı eklendi; bağlı ürünlerin kategorisi sıfırlandı, satıcı güncellemeli'
        : 'Kategori bağlantısı eklendi',
    category: toCategoryResponse(category! as CategoryRecord),
    orphanedProductCount,
  };
};

export const unlinkCategory = async (categoryId: string, input: LinkCategoryInput) => {
  if (input.parentId) {
    await removeCategoryLink(input.parentId, categoryId);
  }

  if (input.childId) {
    await removeCategoryLink(categoryId, input.childId);
  }

  const category = await findCategoryByIdLean(categoryId);

  if (!category) {
    throw new CommerceError(404, 'Kategori bulunamadı');
  }

  invalidateCatalogCache();

  return toCategoryResponse(category as CategoryRecord);
};

export const deleteCategory = async (categoryId: string) => {
  const category = await findCategoryById(categoryId);

  if (!category) {
    throw new CommerceError(404, 'Kategori bulunamadı');
  }

  if (normalizeIds(category.childIds).length > 0) {
    throw new CommerceError(409, 'Alt kategori bulunduğu için silinemez');
  }

  const productCount = await countProductsInCategory(categoryId);

  if (productCount > 0) {
    throw new CommerceError(409, 'Bu kategoride ürün bulunduğu için silinemez');
  }

  for (const parentId of normalizeIds(category.parentIds)) {
    await removeCategoryLink(parentId, categoryId);
  }

  await deleteCategoryById(categoryId);

  invalidateCatalogCache();
};
