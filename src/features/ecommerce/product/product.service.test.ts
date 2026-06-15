import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCategoryCountDocuments = vi.fn();
const mockProductFind = vi.fn();
const mockProductFindOne = vi.fn();
const mockProductFindById = vi.fn();
const mockProductCreate = vi.fn();
const mockProductCountDocuments = vi.fn();
const mockProductFindByIdAndDelete = vi.fn();
const mockGetCategoryDescendantIds = vi.fn();

vi.mock('@/features/ecommerce/category/category.service', () => ({
  getCategoryDescendantIds: (...args: unknown[]) => mockGetCategoryDescendantIds(...args),
}));

vi.mock('@/db', () => ({
  Category: {
    countDocuments: (...args: unknown[]) => mockCategoryCountDocuments(...args),
  },
  Product: {
    find: (...args: unknown[]) => mockProductFind(...args),
    findOne: (...args: unknown[]) => mockProductFindOne(...args),
    findById: (...args: unknown[]) => mockProductFindById(...args),
    create: (...args: unknown[]) => mockProductCreate(...args),
    countDocuments: (...args: unknown[]) => mockProductCountDocuments(...args),
    findByIdAndDelete: (...args: unknown[]) => mockProductFindByIdAndDelete(...args),
  },
}));

vi.mock('@/lib/common/user-id', () => ({
  createUserId: () => '7c9e6679-7425-40de-944b-e07fc1f90ae7',
}));

import {
  createProduct,
  deleteProduct,
  getPublicProductById,
  listPublicProducts,
  updateProduct,
} from '@/features/ecommerce/product/product.service';

const sellerId = '550e8400-e29b-41d4-a716-446655440000';
const categoryId = '660e8400-e29b-41d4-a716-446655440001';
const secondCategoryId = '660e8400-e29b-41d4-a716-446655440002';
const productId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

const productDoc = {
  _id: productId,
  sellerId,
  categoryIds: [categoryId, secondCategoryId],
  primaryCategoryId: categoryId,
  name: 'Kulaklık',
  slug: 'kulaklik',
  description: null,
  price: 999,
  currency: 'TRY',
  stock: 5,
  isActive: true,
  images: [],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('createProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCategoryCountDocuments.mockResolvedValue(1);
    mockProductCreate.mockResolvedValue({
      toObject: () => productDoc,
    });
  });

  it('aktif kategori yoksa 400 fırlatır', async () => {
    mockCategoryCountDocuments.mockResolvedValue(0);

    await expect(
      createProduct(sellerId, {
        categoryIds: [categoryId],
        primaryCategoryId: categoryId,
        name: 'Kulaklık',
        price: 999,
        stock: 5,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Geçersiz kategori',
    });
  });

  it('birden fazla kategori ile ürün oluşturur', async () => {
    mockCategoryCountDocuments.mockResolvedValue(2);

    const result = await createProduct(sellerId, {
      categoryIds: [categoryId, secondCategoryId],
      primaryCategoryId: categoryId,
      name: 'Kulaklık',
      price: 999,
      stock: 5,
    });

    expect(mockProductCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        sellerId,
        categoryIds: [categoryId, secondCategoryId],
        primaryCategoryId: categoryId,
        name: 'Kulaklık',
        slug: 'kulakl-k',
      })
    );
    expect(result.categoryIds).toEqual([categoryId, secondCategoryId]);
  });
});

describe('listPublicProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCategoryDescendantIds.mockResolvedValue([categoryId, 'child-category-id']);
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

    expect(mockProductFind).toHaveBeenCalledWith({ isActive: true });
    expect(result.products).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });

  it('kategori filtresinde alt kategorileri de dahil eder', async () => {
    await listPublicProducts({ page: 1, limit: 20, categoryId });

    expect(mockGetCategoryDescendantIds).toHaveBeenCalledWith(categoryId);
    expect(mockProductFind).toHaveBeenCalledWith({
      isActive: true,
      categoryIds: { $in: [categoryId, 'child-category-id'] },
    });
  });
});

describe('getPublicProductById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aktif ürün yoksa 404 fırlatır', async () => {
    mockProductFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    await expect(getPublicProductById(productId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('updateProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCategoryCountDocuments.mockResolvedValue(1);
  });

  it('başka satıcının ürününü güncelleyemez', async () => {
    mockProductFindById.mockResolvedValue({
      ...productDoc,
      sellerId: 'other-seller',
      save: vi.fn(),
    });

    await expect(updateProduct(sellerId, productId, { price: 100 })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('primaryCategoryId categoryIds dışındaysa hata verir', async () => {
    mockProductFindById.mockResolvedValue({
      ...productDoc,
      save: vi.fn(),
    });

    await expect(
      updateProduct(sellerId, productId, {
        primaryCategoryId: '770e8400-e29b-41d4-a716-446655440000',
      })
    ).rejects.toMatchObject({
      name: 'ZodError',
    });
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
