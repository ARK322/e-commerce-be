import { createUserId } from '@/shared/ids';
import { CommerceError } from '@/shared/errors/commerce-error';
import {
  createProduct as createProductRecord,
  deleteProductById,
  findProductById,
  listSellerProductsLean,
  saveProductDocument,
} from '@/domains/catalog/infrastructure/repositories/product.repository';
import { assertProductCategory } from '@/domains/catalog/application/category/product-category-validation';
import { slugify } from '@/domains/catalog/application/category/slugify';
import { toSellerProductResponse } from '@/domains/catalog/application/product/product-response';
import {
  deleteProductImagesFromStorage,
  uploadProductImage,
  deleteProductImage,
} from '@/domains/catalog/application/product/product-images';
import type { ProductImageUpload } from '@/domains/catalog/application/product/product-image-types';
import { invalidateCatalogProductCache } from '@/domains/catalog/infrastructure/cache/catalog-cache';
import type {
  CreateProductInput,
  UpdateProductInput,
} from '@/domains/catalog/application/product/product-seller.schema';

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
  const product = await findProductById(productId);

  if (!product || product.sellerId !== sellerId) {
    throw new CommerceError(404, 'Ürün bulunamadı');
  }

  return product;
};

export const listSellerProducts = async (sellerId: string) => {
  const products = await listSellerProductsLean(sellerId);

  return products.map(toSellerProductResponse);
};

export const createProduct = async (sellerId: string, input: CreateProductInput) => {
  await assertProductCategory(input.categoryId);

  if (input.minOrderQuantity > input.stock) {
    throw new CommerceError(400, 'Minimum sipariş adedi stoktan fazla olamaz');
  }

  const slug = resolveSlug(input.name, input.slug);

  const product = await createProductRecord({
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

  await invalidateCatalogProductCache();

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
  await saveProductDocument(product);

  await invalidateCatalogProductCache();

  return toSellerProductResponse(product.toObject());
};

export const deleteProduct = async (sellerId: string, productId: string) => {
  const product = await getOwnedProduct(sellerId, productId);
  await deleteProductImagesFromStorage(sellerId, product.images);
  await deleteProductById(String(product._id));

  await invalidateCatalogProductCache();
};

export const addProductImage = async (
  sellerId: string,
  productId: string,
  mimeType: string,
  buffer: Buffer
) => uploadProductImage(sellerId, productId, mimeType, buffer);

export const removeProductImage = async (sellerId: string, productId: string, url: string) =>
  deleteProductImage(sellerId, productId, url);
