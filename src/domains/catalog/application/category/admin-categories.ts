import { createUserId } from '@/shared/ids';
import { CommerceError } from '@/shared/errors/commerce-error';
import {
  createCategory as createCategoryRecord,
  deleteCategoryById,
  findAllCategoriesLean,
  findCategoryById,
  findCategoryByIdLean,
  saveCategoryDocument,
  updateCategoriesByIds,
} from '@/domains/catalog/infrastructure/repositories/category.repository';
import {
  countProductsInCategory,
  deactivateProductsInCategories,
} from '@/domains/catalog/infrastructure/repositories/product.repository';
import {
  buildCategoryForest,
  collectDescendantIds,
  uniqueIds,
} from '@/domains/catalog/application/category/category-graph';
import { loadCategoryGraphNodes } from '@/domains/catalog/application/category/load-category-graph';
import type {
  CreateCategoryInput,
  LinkCategoryInput,
  UpdateCategoryInput,
} from '@/domains/catalog/application/category/category-admin.schema';
import { invalidateCatalogCache } from '@/domains/catalog/infrastructure/cache/catalog-cache';
import {
  assertCategoryExists,
  normalizeIds,
  resolveSlug,
  toCategoryResponse,
  type CategoryRecord,
} from '@/domains/catalog/application/category/category-helpers';
import {
  addCategoryLink,
  removeCategoryLink,
} from '@/domains/catalog/application/category/category-links';
import { getCategoryPaths } from '@/domains/catalog/application/category/public-categories';

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

  await invalidateCatalogCache();

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

  await invalidateCatalogCache();

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

  await invalidateCatalogCache();

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

  await invalidateCatalogCache();

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

  await invalidateCatalogCache();
};
