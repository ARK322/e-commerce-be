import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMemoryCache } from '@/domains/catalog/infrastructure/cache/memory-cache';

const mockAssertProductCategory = vi.fn();
const mockGetCategoryProductFilterIds = vi.fn();

vi.mock('@/domains/catalog/application/category/visible-categories', () => ({
  getPublicVisibleCategoryIds: vi.fn().mockResolvedValue(
    new Set(['660e8400-e29b-41d4-a716-446655440001', 'leaf-category-id'])
  ),
  isCategoryPubliclyVisible: vi.fn().mockResolvedValue(true),
  invalidateVisibleCategoryIdsCache: vi.fn(),
}));

vi.mock('@/domains/catalog/application/category/product-category-validation', () => ({
  assertProductCategory: (...args: unknown[]) => mockAssertProductCategory(...args),
}));

vi.mock('@/domains/catalog/application/category/product-category-filters', () => ({
  getCategoryProductFilterIds: (...args: unknown[]) => mockGetCategoryProductFilterIds(...args),
}));

vi.mock('@/domains/catalog/application/product/product-images', () => ({
  deleteProductImagesFromStorage: vi.fn().mockResolvedValue(undefined),
  uploadProductImage: vi.fn(),
}));

const mockProductFind = vi.fn();
const mockProductFindOne = vi.fn();
const mockProductFindById = vi.fn();
const mockProductCreate = vi.fn();
const mockProductCountDocuments = vi.fn();
const mockProductFindByIdAndDelete = vi.fn();

vi.mock('@/integrations/mongo', () => ({
  Product: {
    find: (...args: unknown[]) => mockProductFind(...args),
    findOne: (...args: unknown[]) => mockProductFindOne(...args),
    findById: (...args: unknown[]) => mockProductFindById(...args),
    create: (...args: unknown[]) => mockProductCreate(...args),
    countDocuments: (...args: unknown[]) => mockProductCountDocuments(...args),
    findByIdAndDelete: (...args: unknown[]) => mockProductFindByIdAndDelete(...args),
  },
}));

vi.mock('@/shared/ids', () => ({
  createUserId: () => '7c9e6679-7425-40de-944b-e07fc1f90ae7',
}));

import {
  getPublicProductById,
  listPublicProducts,
} from '@/api/public/catalog/products/product.service';
import {
  createProduct,
  createProductWithImages,
  deleteProduct,
  updateProduct,
} from '@/api/seller/products/seller-products.service';
import { uploadProductImage } from '@/domains/catalog/application/product/product-images';

const sellerId = '550e8400-e29b-41d4-a716-446655440000';
const categoryId = '660e8400-e29b-41d4-a716-446655440001';
const productId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

const productDoc = {
  _id: productId,
  sellerId,
  categoryId,
  name: 'Kulaklık',
  slug: 'kulaklik',
  description: null,
  price: 999,
  currency: 'TRY',
  stock: 5,
  minOrderQuantity: 1,
  isActive: true,
  images: [],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('createProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertProductCategory.mockResolvedValue(undefined);
    mockProductCreate.mockImplementation((data) => ({
      toObject: () => ({
        ...productDoc,
        ...data,
        _id: productId,
      }),
    }));
  });

  it('leaf kategori doğrulaması yapar', async () => {
    await createProduct(sellerId, {
      categoryId,
      name: 'Kulaklık',
      price: 999,
      stock: 5,
      minOrderQuantity: 1,
    });

    expect(mockAssertProductCategory).toHaveBeenCalledWith(categoryId);
    expect(mockProductCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        sellerId,
        categoryId,
        name: 'Kulaklık',
        slug: 'kulakl-k',
      })
    );
  });

  it('geçersiz kategoride 400 fırlatır', async () => {
    mockAssertProductCategory.mockRejectedValue({
      statusCode: 400,
      message: 'Geçersiz kategori',
    });

    await expect(
      createProduct(sellerId, {
        categoryId,
        name: 'Kulaklık',
        price: 999,
        stock: 5,
        minOrderQuantity: 1,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Geçersiz kategori',
    });
  });

  it('leaf olmayan kategoride 400 fırlatır', async () => {
    mockAssertProductCategory.mockRejectedValue({
      statusCode: 400,
      message: 'Ürün yalnızca alt kategoriye eklenebilir',
    });

    await expect(
      createProduct(sellerId, {
        categoryId,
        name: 'Kulaklık',
        price: 999,
        stock: 5,
        minOrderQuantity: 1,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Ürün yalnızca alt kategoriye eklenebilir',
    });
  });
});

describe('createProductWithImages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertProductCategory.mockResolvedValue(undefined);
    mockProductCreate.mockImplementation((data) => ({
      toObject: () => ({
        ...productDoc,
        ...data,
        _id: productId,
      }),
    }));
    mockProductFindById.mockReturnValue({
      sellerId,
      images: [],
      updatedAt: new Date(),
      save: vi.fn(),
      toObject: () => productDoc,
    });
    mockProductFindByIdAndDelete.mockResolvedValue(productDoc);
  });

  it('görsel yoksa sadece ürün oluşturur', async () => {
    const result = await createProductWithImages(sellerId, {
      categoryId,
      name: 'Kulaklık',
      price: 999,
      stock: 5,
      minOrderQuantity: 1,
    });

    expect(uploadProductImage).not.toHaveBeenCalled();
    expect(result.id).toBe(productId);
    expect(result.categoryId).toBe(categoryId);
  });
});

describe('listPublicProducts', () => {
  beforeEach(() => {
    clearMemoryCache();
    vi.clearAllMocks();
    mockGetCategoryProductFilterIds.mockResolvedValue([categoryId, 'leaf-category-id']);
    mockProductFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([productDoc]),
          }),
        }),
      }),
    });
    mockProductCountDocuments.mockResolvedValue(1);
  });

  it('sadece aktif ürünleri listeler', async () => {
    const result = await listPublicProducts({ page: 1, limit: 20 });

    expect(mockProductFind).toHaveBeenCalledWith({
      isActive: true,
      categoryId: { $in: ['660e8400-e29b-41d4-a716-446655440001', 'leaf-category-id'] },
    });
    expect(result.products).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });

  it('kategori filtresinde alt evrendeki leaf ürünlerini döner', async () => {
    await listPublicProducts({ page: 1, limit: 20, categoryId });

    expect(mockGetCategoryProductFilterIds).toHaveBeenCalledWith(categoryId);
    expect(mockProductFind).toHaveBeenCalledWith({
      isActive: true,
      categoryId: { $in: [categoryId, 'leaf-category-id'] },
    });
  });

  it('aynı sorguda ikinci çağrı Mongo find tekrarlamaz', async () => {
    const query = { page: 1, limit: 20 };

    await listPublicProducts(query);
    await listPublicProducts(query);

    expect(mockProductFind).toHaveBeenCalledTimes(1);
    expect(mockProductCountDocuments).toHaveBeenCalledTimes(1);
  });
});

describe('updateProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertProductCategory.mockResolvedValue(undefined);
  });

  it('categoryId güncellerken leaf doğrulaması yapar', async () => {
    const secondCategoryId = '660e8400-e29b-41d4-a716-446655440002';
    const mutableProduct = {
      ...productDoc,
      categoryId,
      save: vi.fn(),
      toObject() {
        return { ...productDoc, categoryId: secondCategoryId };
      },
    };

    mockProductFindById.mockResolvedValue(mutableProduct);

    await updateProduct(sellerId, productId, { categoryId: secondCategoryId });

    expect(mockAssertProductCategory).toHaveBeenCalledWith(secondCategoryId);
    expect(mutableProduct.categoryId).toBe(secondCategoryId);
  });
});

describe('deleteProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProductFindById.mockResolvedValue(productDoc);
  });

  it('kendi ürününü siler', async () => {
    await deleteProduct(sellerId, productId);

    expect(mockProductFindByIdAndDelete).toHaveBeenCalledWith(productId);
  });
});
