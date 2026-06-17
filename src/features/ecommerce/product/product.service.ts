import { Category, Product } from '@/db';
import { createUserId } from '@/lib/common/user-id';
import { EcommerceError } from '@/features/ecommerce/core/errors';
import { getCategoryDescendantIds } from '@/features/ecommerce/category/category.service';
import { slugify } from '@/features/ecommerce/category/slugify';
import { resolveProductCategoryAssignment } from '@/features/ecommerce/product/product-category.schema';
import {
  toPublicProductResponse,
  toSellerProductResponse,
  type ProductRecord,
} from '@/features/ecommerce/product/product-response';
import { deleteProductImagesFromStorage, uploadProductImage } from '@/features/ecommerce/product/product-images.service';
import type { ProductImageUpload } from '@/features/ecommerce/product/product-image-types';
import type { CreateProductInput } from '@/features/ecommerce/product/create-product.schema';
import type { ListProductsQuery } from '@/features/ecommerce/product/list-products.schema';
import type { UpdateProductInput } from '@/features/ecommerce/product/update-product.schema';

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

const assertActiveCategories = async (categoryIds: string[]) => {
  const uniqueIds = [...new Set(categoryIds)];

  const activeCount = await Category.countDocuments({
    _id: { $in: uniqueIds },
    isActive: true,
  });

  if (activeCount !== uniqueIds.length) {
    throw new EcommerceError(400, 'Geçersiz kategori');
  }
};

const getOwnedProduct = async (sellerId: string, productId: string) => {
  const product = await Product.findById(productId);

  if (!product || product.sellerId !== sellerId) {
    throw new EcommerceError(404, 'Ürün bulunamadı');
  }

  return product;
};

const buildPublicFilter = async (query: ListProductsQuery) => {
  const filter: Record<string, unknown> = { isActive: true };

  if (query.categoryId) {
    const expandedCategoryIds = await getCategoryDescendantIds(query.categoryId);
    filter.categoryIds = { $in: expandedCategoryIds };
  }

  if (query.search) {
    filter.name = { $regex: query.search, $options: 'i' };
  }

  return filter;
};

export const listPublicProducts = async (query: ListProductsQuery) => {
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
  const product = await Product.findOne({ _id: productId, isActive: true }).lean();

  if (!product) {
    throw new EcommerceError(404, 'Ürün bulunamadı');
  }

  return toPublicProductResponse(product);
};

export const listSellerProducts = async (sellerId: string) => {
  const products = await Product.find({ sellerId }).sort({ createdAt: -1 }).lean();

  return products.map(toSellerProductResponse);
};

export const createProduct = async (sellerId: string, input: CreateProductInput) => {
  await assertActiveCategories(input.categoryIds);

  const slug = resolveSlug(input.name, input.slug);

  const product = await Product.create({
    _id: createUserId(),
    sellerId,
    categoryIds: input.categoryIds,
    primaryCategoryId: input.primaryCategoryId,
    name: input.name,
    slug,
    description: input.description ?? null,
    price: input.price,
    stock: input.stock,
    minOrderQuantity: input.minOrderQuantity,
    isActive: input.isActive ?? true,
    images: [],
  });

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

  if (input.categoryIds !== undefined || input.primaryCategoryId !== undefined) {
    const assignment = resolveProductCategoryAssignment(
      {
        categoryIds: product.categoryIds,
        primaryCategoryId: product.primaryCategoryId,
      },
      {
        categoryIds: input.categoryIds,
        primaryCategoryId: input.primaryCategoryId,
      }
    );

    await assertActiveCategories(assignment.categoryIds);
    product.categoryIds = assignment.categoryIds;
    product.primaryCategoryId = assignment.primaryCategoryId;
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

  if (input.images !== undefined) {
    product.images = input.images;
  }

  product.updatedAt = new Date();
  await product.save();

  return toSellerProductResponse(product.toObject());
};

export const deleteProduct = async (sellerId: string, productId: string) => {
  const product = await getOwnedProduct(sellerId, productId);
  await deleteProductImagesFromStorage(product.images);
  await Product.findByIdAndDelete(product._id);
};
