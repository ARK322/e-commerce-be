import { Category, Product } from '@/db';
import { createUserId } from '@/lib/common/user-id';
import { EcommerceError } from '@/features/ecommerce/core/errors';
import { getCategoryDescendantIds } from '@/features/ecommerce/category/category.service';
import { slugify } from '@/features/ecommerce/category/slugify';
import { resolveProductCategoryAssignment } from '@/features/ecommerce/product/product-category.schema';
import type { CreateProductInput } from '@/features/ecommerce/product/create-product.schema';
import type { ListProductsQuery } from '@/features/ecommerce/product/list-products.schema';
import type { UpdateProductInput } from '@/features/ecommerce/product/update-product.schema';

type ProductRecord = {
  _id: unknown;
  sellerId: string;
  categoryIds: string[];
  primaryCategoryId: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  price: number;
  currency: string;
  stock: number;
  isActive: boolean;
  images: string[];
  createdAt?: Date;
  updatedAt?: Date;
};

const toPublicProductResponse = (product: ProductRecord) => ({
  id: String(product._id),
  sellerId: product.sellerId,
  categoryIds: product.categoryIds,
  primaryCategoryId: product.primaryCategoryId,
  name: product.name,
  slug: product.slug ?? null,
  description: product.description ?? null,
  price: product.price,
  currency: product.currency,
  stock: product.stock,
  images: product.images,
  createdAt: product.createdAt,
});

const toSellerProductResponse = (product: ProductRecord) => ({
  ...toPublicProductResponse(product),
  isActive: product.isActive,
  updatedAt: product.updatedAt,
});

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
    isActive: input.isActive ?? true,
    images: input.images ?? [],
  });

  return toSellerProductResponse(product.toObject());
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
  await Product.findByIdAndDelete(product._id);
};
