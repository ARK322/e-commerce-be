import { CommerceError } from '@/shared/errors/commerce-error';
import {
  countProducts,
  findPublicActiveProductLean,
  listProductsLean,
} from '@/domains/catalog/infrastructure/repositories/product.repository';
import { getCategoryProductFilterIds } from '@/domains/catalog/application/category/product-category-filters';
import { escapeRegex } from '@/shared/validation/escape-regex';
import { isCategoryPubliclyVisible, getPublicVisibleCategoryIds } from '@/domains/catalog/application/category/visible-categories';
import { toPublicProductResponse } from '@/domains/catalog/application/product/product-response';
import { catalogCacheKeys } from '@/domains/catalog/infrastructure/cache/catalog-keys';
import { catalogCacheConfig } from '@/domains/catalog/infrastructure/cache/catalog-cache-config';
import { getCatalogCacheStore } from '@/domains/catalog/infrastructure/cache/catalog-cache-store';
import type { ListProductsQuery } from '@/domains/catalog/application/product/list-products.schema';

const buildPublicFilter = async (query: ListProductsQuery) => {
  const visibleCategoryIds = [...(await getPublicVisibleCategoryIds())];

  const filter: Record<string, unknown> = {
    isActive: true,
    categoryId: { $in: visibleCategoryIds },
  };

  if (query.categoryId) {
    const leafCategoryIds = await getCategoryProductFilterIds(query.categoryId);
    const visibleLeafIds = leafCategoryIds.filter((id) => visibleCategoryIds.includes(id));
    filter.categoryId = { $in: visibleLeafIds };
  }

  if (query.search) {
    filter.name = { $regex: escapeRegex(query.search), $options: 'i' };
  }

  return filter;
};

const listPublicProductsUncached = async (query: ListProductsQuery) => {
  const filter = await buildPublicFilter(query);
  const skip = (query.page - 1) * query.limit;

  const [products, total] = await Promise.all([
    listProductsLean(filter, { skip, limit: query.limit }),
    countProducts(filter),
  ]);

  return {
    products: products.map(toPublicProductResponse),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit) || 0,
    },
  };
};

export const listPublicProducts = async (query: ListProductsQuery) => {
  if (!catalogCacheConfig.enabled) {
    return listPublicProductsUncached(query);
  }

  const store = getCatalogCacheStore();
  const cacheKey = catalogCacheKeys.productsList(query);
  const cached = await store.get<Awaited<ReturnType<typeof listPublicProductsUncached>>>(cacheKey);

  if (cached) {
    return cached;
  }

  const result = await listPublicProductsUncached(query);
  await store.set(cacheKey, result, { ttlMs: catalogCacheConfig.productsListTtlMs });

  return result;
};

const getPublicProductByIdUncached = async (productId: string) => {
  const product = await findPublicActiveProductLean(productId);

  if (!product || !product.categoryId) {
    throw new CommerceError(404, 'Ürün bulunamadı');
  }

  const visible = await isCategoryPubliclyVisible(product.categoryId);

  if (!visible) {
    throw new CommerceError(404, 'Ürün bulunamadı');
  }

  return toPublicProductResponse(product);
};

export const getPublicProductById = async (productId: string) => {
  if (!catalogCacheConfig.enabled) {
    return getPublicProductByIdUncached(productId);
  }

  const store = getCatalogCacheStore();
  const cacheKey = catalogCacheKeys.productDetail(productId);
  const cached = await store.get<Awaited<ReturnType<typeof getPublicProductByIdUncached>>>(cacheKey);

  if (cached) {
    return cached;
  }

  const product = await getPublicProductByIdUncached(productId);
  await store.set(cacheKey, product, { ttlMs: catalogCacheConfig.productDetailTtlMs });

  return product;
};
