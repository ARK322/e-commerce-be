import { createUserId } from '@/internal/common/ids';
import { CommerceError } from '@/internal/common/errors/commerce-error';
import {
  createCategory as createCategoryRecord,
  deleteCategoryById,
  findActiveCategoriesLean,
  findAllCategoriesLean,
  findCategoryById,
  findCategoryByIdLean,
  findCategoryByIdSelectLean,
  saveCategoryDocument,
  updateCategoriesByIds,
} from '@/repositories/catalog/category.repository';
import {
  clearProductsInCategory,
  countProductsInCategory,
  deactivateProductsInCategories,
} from '@/repositories/catalog/product.repository';
import {
  MAX_CHILDREN_PER_NODE,
  MAX_PARENTS_PER_NODE,
  buildCategoryForest,
  collectAncestorPaths,
  collectDescendantIds,
  filterCategoriesWithActiveAncestors,
  uniqueIds,
  wouldCreateCycle,
  type CategoryGraphNode,
} from '@/internal/catalog/category/category-graph';
import { loadCategoryGraphNodes } from '@/internal/catalog/category/load-category-graph';
import { slugify } from '@/internal/catalog/category/slugify';
import { catalogCacheKeys } from '@/internal/common/cache/catalog-keys';
import { catalogCacheConfig } from '@/internal/common/cache/catalog-cache-config';
import { invalidateCatalogCache } from '@/internal/common/cache/catalog-cache';
import { memoryCache } from '@/internal/common/cache/memory-cache';
import type {
  CreateCategoryInput,
  LinkCategoryInput,
  UpdateCategoryInput,
} from '@/internal/catalog/category/category-admin.schema';

type CategoryRecord = {
  _id: unknown;
  parentIds?: string[];
  childIds?: string[];
  name: string;
  slug: string;
  isActive: boolean;
  isLeaf?: boolean;
  createdAt?: Date;
};

const normalizeIds = (ids: string[] | undefined) => uniqueIds(ids ?? []);

const toGraphNode = (category: CategoryRecord): CategoryGraphNode => ({
  id: String(category._id),
  parentIds: normalizeIds(category.parentIds),
  childIds: normalizeIds(category.childIds),
  isActive: category.isActive,
  isLeaf: category.isLeaf ?? normalizeIds(category.childIds).length === 0,
});

const toCategoryResponse = (category: CategoryRecord) => ({
  id: String(category._id),
  parentIds: normalizeIds(category.parentIds),
  childIds: normalizeIds(category.childIds),
  name: category.name,
  slug: category.slug,
  isActive: category.isActive,
  isLeaf: category.isLeaf ?? normalizeIds(category.childIds).length === 0,
  createdAt: category.createdAt,
});

const toPublicCategoryResponse = (category: CategoryRecord) => ({
  id: String(category._id),
  parentIds: normalizeIds(category.parentIds),
  childIds: normalizeIds(category.childIds),
  name: category.name,
  slug: category.slug,
  isLeaf: category.isLeaf ?? normalizeIds(category.childIds).length === 0,
});

const resolveSlug = (name: string, slug?: string) => {
  const resolved = slug ?? slugify(name);

  if (!resolved) {
    throw new CommerceError(400, 'Geçerli bir slug üretilemedi');
  }

  return resolved;
};

const refreshLeafFlag = async (categoryId: string) => {
  const category = await findCategoryById(categoryId);

  if (!category) {
    return;
  }

  category.isLeaf = normalizeIds(category.childIds).length === 0;
  await saveCategoryDocument(category);
};

const assertCategoryExists = async (categoryId: string, label: string) => {
  const category = await findCategoryByIdSelectLean(categoryId, '_id');

  if (!category) {
    throw new CommerceError(400, `${label} bulunamadı`);
  }
};

const addLink = async (parentId: string, childId: string) => {
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

const removeLink = async (parentId: string, childId: string) => {
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

export const getCategoryDescendantIds = async (categoryId: string) => {
  const category = await findCategoryByIdSelectLean(categoryId, '_id');

  if (!category) {
    throw new CommerceError(404, 'Kategori bulunamadı');
  }

  const graphNodes = await loadCategoryGraphNodes();

  return [categoryId, ...collectDescendantIds(categoryId, graphNodes)];
};

export const getCategoryPaths = async (categoryId: string) => {
  const category = await findCategoryByIdLean(categoryId);

  if (!category) {
    throw new CommerceError(404, 'Kategori bulunamadı');
  }

  const graphNodes = await loadCategoryGraphNodes();
  const visibleNodes = filterCategoriesWithActiveAncestors(graphNodes);
  const isVisible = visibleNodes.some((node) => node.id === categoryId);

  if (!isVisible) {
    throw new CommerceError(404, 'Kategori bulunamadı');
  }

  return collectAncestorPaths(categoryId, graphNodes);
};

const listPublicCategoriesUncached = async () => {
  const categories = await findActiveCategoriesLean();
  const graphNodes = categories.map((category) => toGraphNode(category));
  const visibleNodes = filterCategoriesWithActiveAncestors(graphNodes);
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const flatCategories = categories
    .filter((category) => visibleIds.has(String(category._id)))
    .map(toPublicCategoryResponse);

  return buildCategoryForest(flatCategories, (category) => category);
};

export const listPublicCategories = async () => {
  if (!catalogCacheConfig.enabled) {
    return listPublicCategoriesUncached();
  }

  const cacheKey = catalogCacheKeys.publicCategories();
  const cached = memoryCache.get<Awaited<ReturnType<typeof listPublicCategoriesUncached>>>(cacheKey);

  if (cached) {
    return cached;
  }

  const categories = await listPublicCategoriesUncached();
  memoryCache.set(cacheKey, categories, { ttlMs: catalogCacheConfig.categoriesTtlMs });

  return categories;
};

export const listAdminCategories = async () => {
  const categories = await findAllCategoriesLean();
  const flatCategories = categories.map(toCategoryResponse);

  return buildCategoryForest(flatCategories, (category) => category);
};

export const getCategoryById = async (categoryId: string) => {
  const category = await findCategoryByIdLean(categoryId);

  if (!category) {
    throw new CommerceError(404, 'Kategori bulunamadı');
  }

  const paths = await getCategoryPaths(categoryId);

  return {
    ...toCategoryResponse(category),
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

  const category = await createCategoryRecord({
    _id: categoryId,
    parentIds: [],
    childIds: [],
    name: input.name,
    slug,
    isActive: input.isActive ?? true,
    isLeaf: true,
  });

  for (const parentId of parentIds) {
    await addLink(parentId, categoryId);
  }

  const fresh = await findCategoryByIdLean(categoryId);

  invalidateCatalogCache();

  return toCategoryResponse(fresh!);
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

  return toCategoryResponse(category.toObject());
};

export const linkCategory = async (categoryId: string, input: LinkCategoryInput) => {
  await assertCategoryExists(categoryId, 'Kategori');

  let orphanedProductCount = 0;

  if (input.parentId) {
    const result = await addLink(input.parentId, categoryId);
    orphanedProductCount += result.orphanedProductCount;
  }

  if (input.childId) {
    const result = await addLink(categoryId, input.childId);
    orphanedProductCount += result.orphanedProductCount;
  }

  const category = await findCategoryByIdLean(categoryId);

  invalidateCatalogCache();

  return {
    message:
      orphanedProductCount > 0
        ? 'Kategori bağlantısı eklendi; bağlı ürünlerin kategorisi sıfırlandı, satıcı güncellemeli'
        : 'Kategori bağlantısı eklendi',
    category: toCategoryResponse(category!),
    orphanedProductCount,
  };
};

export const unlinkCategory = async (categoryId: string, input: LinkCategoryInput) => {
  if (input.parentId) {
    await removeLink(input.parentId, categoryId);
  }

  if (input.childId) {
    await removeLink(categoryId, input.childId);
  }

  const category = await findCategoryByIdLean(categoryId);

  if (!category) {
    throw new CommerceError(404, 'Kategori bulunamadı');
  }

  invalidateCatalogCache();

  return toCategoryResponse(category);
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
    await removeLink(parentId, categoryId);
  }

  await deleteCategoryById(categoryId);

  invalidateCatalogCache();
};
