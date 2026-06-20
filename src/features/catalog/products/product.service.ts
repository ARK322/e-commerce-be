import { Product } from '@/integrations/mongo';
import type { FastifyRequest } from 'fastify';
import { createUserId } from '@/internal/common/ids';
import { CommerceError } from '@/internal/common/errors/commerce-error';
import {
  assertProductCategory,
  getCategoryProductFilterIds,
} from '@/features/catalog/categories/category.service';
import { escapeRegex } from '@/internal/common/validation/escape-regex';
import { slugify } from '@/internal/catalog/category/slugify';
import { getPublicVisibleCategoryIds, isCategoryPubliclyVisible } from '@/internal/catalog/category/visible-categories';
import {
  toPublicProductResponse,
  toSellerProductResponse,
} from '@/internal/catalog/product/product-response';
import { deleteProductImagesFromStorage, uploadProductImage, deleteProductImage } from '@/internal/catalog/product/product-images';
import type { ProductImageUpload } from '@/internal/catalog/product/product-image-types';
import { parseCreateProductRequest } from '@/internal/catalog/product/parse-create-product-request';
import { catalogCacheKeys } from '@/internal/common/cache/catalog-keys';
import { catalogCacheConfig } from '@/internal/common/cache/catalog-cache-config';
import { invalidateCatalogProductCache } from '@/internal/common/cache/catalog-cache';
import { memoryCache } from '@/internal/common/cache/memory-cache';
import {
  createProductSchema,
  type CreateProductInput,
} from '@/features/catalog/products/create-product.schema';
import type { ListProductsQuery } from '@/features/catalog/products/list-products.schema';
import type { UpdateProductInput } from '@/features/catalog/products/update-product.schema';

const resolveSlug = (name: string, slug?: string | null) => {
  if (slug === null) {
    return null;
  }

  const resolved = slug ?? slugify(name);

  if (!resolved) {
    return null;
  }

  return resolved;
};

const getOwnedProduct = async (sellerId: string, productId: string) => {
  const product = await Product.findById(productId);

  if (!product || product.sellerId !== sellerId) {
    throw new CommerceError(404, 'Ürün bulunamadı');
  }

  return product;
};

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

export const listPublicProducts = async (query: ListProductsQuery) => {
  if (!catalogCacheConfig.enabled) {
    return listPublicProductsUncached(query);
  }

  const cacheKey = catalogCacheKeys.productsList(query);
  const cached = memoryCache.get<Awaited<ReturnType<typeof listPublicProductsUncached>>>(cacheKey);

  if (cached) {
    return cached;
  }

  const result = await listPublicProductsUncached(query);
  memoryCache.set(cacheKey, result, { ttlMs: catalogCacheConfig.productsListTtlMs });

  return result;
};

const listPublicProductsUncached = async (query: ListProductsQuery) => {
  const filter = await buildPublicFilter(query);
  const skip = (query.page - 1) * query.limit;

  const [products, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
    Product.countDocuments(filter),
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

export const getPublicProductById = async (productId: string) => {
  if (!catalogCacheConfig.enabled) {
    return getPublicProductByIdUncached(productId);
  }

  const cacheKey = catalogCacheKeys.productDetail(productId);
  const cached = memoryCache.get<Awaited<ReturnType<typeof getPublicProductByIdUncached>>>(cacheKey);

  if (cached) {
    return cached;
  }

  const product = await getPublicProductByIdUncached(productId);
  memoryCache.set(cacheKey, product, { ttlMs: catalogCacheConfig.productDetailTtlMs });

  return product;
};

const getPublicProductByIdUncached = async (productId: string) => {
  const product = await Product.findOne({
    _id: productId,
    isActive: true,
    categoryId: { $ne: null },
  }).lean();

  if (!product || !product.categoryId) {
    throw new CommerceError(404, 'Ürün bulunamadı');
  }

  const visible = await isCategoryPubliclyVisible(product.categoryId);

  if (!visible) {
    throw new CommerceError(404, 'Ürün bulunamadı');
  }

  return toPublicProductResponse(product);
};

export const listSellerProducts = async (sellerId: string) => {
  const products = await Product.find({ sellerId }).sort({ createdAt: -1 }).lean();

  return products.map(toSellerProductResponse);
};

export const createProduct = async (sellerId: string, input: CreateProductInput) => {
  await assertProductCategory(input.categoryId);

  const slug = resolveSlug(input.name, input.slug);

  const product = await Product.create({
    _id: createUserId(),
    sellerId,
    categoryId: input.categoryId,
    name: input.name,
    slug,
    description: input.description ?? null,
    price: input.price,
    stock: input.stock,
    minOrderQuantity: input.minOrderQuantity,
    isActive: input.isActive ?? true,
    images: [],
  });

  invalidateCatalogProductCache();

  return toSellerProductResponse(product.toObject());
};

export const createProductWithImages = async (
  sellerId: string,
  input: CreateProductInput,
  images: ProductImageUpload[] = []
) => {
  const product = await createProduct(sellerId, input);

  if (images.length === 0) {
    return product;
  }

  try {
    let latestProduct = product;

    for (const image of images) {
      const result = await uploadProductImage(
        sellerId,
        product.id,
        image.mimeType,
        image.buffer
      );
      latestProduct = result.product;
    }

    return latestProduct;
  } catch (error) {
    await deleteProduct(sellerId, product.id);
    throw error;
  }
};

export const createProductFromRequest = async (sellerId: string, request: FastifyRequest) => {
  const { input, images } = await parseCreateProductRequest(request, createProductSchema);
  const product = await createProductWithImages(sellerId, input, images);

  return { product, imageCount: images.length };
};

export const updateProduct = async (
  sellerId: string,
  productId: string,
  input: UpdateProductInput
) => {
  const product = await getOwnedProduct(sellerId, productId);

  if (input.categoryId !== undefined) {
    await assertProductCategory(input.categoryId);
    product.categoryId = input.categoryId;
  }

  if (input.name !== undefined) {
    product.name = input.name;
  }

  if (input.slug !== undefined) {
    product.slug = input.slug;
  } else if (input.name !== undefined) {
    product.slug = resolveSlug(input.name);
  }

  if (input.description !== undefined) {
    product.description = input.description;
  }

  if (input.price !== undefined) {
    product.price = input.price;
  }

  if (input.stock !== undefined) {
    product.stock = input.stock;
  }

  if (input.minOrderQuantity !== undefined) {
    product.minOrderQuantity = input.minOrderQuantity;
  }

  if (input.isActive !== undefined) {
    product.isActive = input.isActive;
  }

  if (
    input.minOrderQuantity !== undefined &&
    input.stock !== undefined &&
    input.minOrderQuantity > input.stock
  ) {
    throw new CommerceError(400, 'Minimum sipariş adedi stoktan fazla olamaz');
  } else if (
    input.minOrderQuantity !== undefined &&
    input.stock === undefined &&
    input.minOrderQuantity > product.stock
  ) {
    throw new CommerceError(400, 'Minimum sipariş adedi stoktan fazla olamaz');
  } else if (
    input.stock !== undefined &&
    input.minOrderQuantity === undefined &&
    product.minOrderQuantity > input.stock
  ) {
    throw new CommerceError(400, 'Minimum sipariş adedi stoktan fazla olamaz');
  }

  product.updatedAt = new Date();
  await product.save();

  invalidateCatalogProductCache();

  return toSellerProductResponse(product.toObject());
};

export const deleteProduct = async (sellerId: string, productId: string) => {
  const product = await getOwnedProduct(sellerId, productId);
  await deleteProductImagesFromStorage(product.images);
  await Product.findByIdAndDelete(product._id);

  invalidateCatalogProductCache();
};

export const addProductImage = async (
  sellerId: string,
  productId: string,
  mimeType: string,
  buffer: Buffer
) => uploadProductImage(sellerId, productId, mimeType, buffer);

export const removeProductImage = async (sellerId: string, productId: string, url: string) =>
  deleteProductImage(sellerId, productId, url);
