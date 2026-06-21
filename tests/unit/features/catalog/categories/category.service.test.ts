import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMemoryCache } from '@/internal/common/cache/memory-cache';

const mockCategoryFind = vi.fn();
const mockCategoryFindById = vi.fn();
const mockCategoryCreate = vi.fn();
const mockCategoryFindByIdAndDelete = vi.fn();
const mockCategoryUpdateMany = vi.fn();
const mockProductCountDocuments = vi.fn();
const mockProductUpdateMany = vi.fn();

vi.mock('@/integrations/mongo', () => ({
  Category: {
    find: (...args: unknown[]) => mockCategoryFind(...args),
    findById: (...args: unknown[]) => mockCategoryFindById(...args),
    create: (...args: unknown[]) => mockCategoryCreate(...args),
    findByIdAndDelete: (...args: unknown[]) => mockCategoryFindByIdAndDelete(...args),
    updateMany: (...args: unknown[]) => mockCategoryUpdateMany(...args),
  },
  Product: {
    countDocuments: (...args: unknown[]) => mockProductCountDocuments(...args),
    updateMany: (...args: unknown[]) => mockProductUpdateMany(...args),
  },
}));

vi.mock('@/internal/common/ids', () => ({
  createUserId: () => '7c9e6679-7425-40de-944b-e07fc1f90ae7',
}));

import {
  listPublicCategories,
} from '@/features/catalog/categories/category.service';
import {
  deleteCategory,
  getCategoryById,
  updateCategory,
} from '@/features/admin/categories/admin-categories.service';

const categoryId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const childCategoryId = '8d9e6679-7425-40de-944b-e07fc1f90ae8';

const rootCategoryDoc = {
  _id: categoryId,
  parentIds: [],
  childIds: [childCategoryId],
  name: 'Elektronik',
  slug: 'elektronik',
  isActive: true,
  isLeaf: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const childCategoryDoc = {
  _id: childCategoryId,
  parentIds: [categoryId],
  childIds: [],
  name: 'Telefon',
  slug: 'telefon',
  isActive: true,
  isLeaf: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('listPublicCategories', () => {
  beforeEach(() => {
    clearMemoryCache();
    vi.clearAllMocks();
    mockCategoryFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([rootCategoryDoc, childCategoryDoc]),
    });
  });

  it('evren ormanında public kategorileri döner', async () => {
    const result = await listPublicCategories();

    expect(result).toEqual([
      {
        id: categoryId,
        parentIds: [],
        childIds: [childCategoryId],
        name: 'Elektronik',
        slug: 'elektronik',
        isLeaf: false,
        children: [
          {
            id: childCategoryId,
            parentIds: [categoryId],
            childIds: [],
            name: 'Telefon',
            slug: 'telefon',
            isLeaf: true,
            children: [],
          },
        ],
      },
    ]);
  });

  it('ikinci çağrıda Mongo sorgusu tekrarlanmaz', async () => {
    await listPublicCategories();
    await listPublicCategories();

    expect(mockCategoryFind).toHaveBeenCalledTimes(1);
  });
});

describe('getCategoryById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCategoryFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: categoryId,
            parentIds: [],
            childIds: [childCategoryId],
            isActive: true,
            isLeaf: false,
          },
          {
            _id: childCategoryId,
            parentIds: [categoryId],
            childIds: [],
            isActive: true,
            isLeaf: true,
          },
        ]),
      }),
    });
  });

  it('kategori yoksa 404 fırlatır', async () => {
    mockCategoryFindById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    await expect(getCategoryById(categoryId)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Kategori bulunamadı',
    });
  });

  it('paths ile kategori detayı döner', async () => {
    mockCategoryFindById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(childCategoryDoc),
    });

    const result = await getCategoryById(childCategoryId);

    expect(result).toMatchObject({
      id: childCategoryId,
      parentIds: [categoryId],
      childIds: [],
      isLeaf: true,
      paths: [[categoryId, childCategoryId]],
    });
  });
});

describe('deleteCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCategoryFindById.mockResolvedValue({
      ...rootCategoryDoc,
      parentIds: [],
      childIds: [],
    });
  });

  it('alt kategori varsa 409 fırlatır', async () => {
    mockCategoryFindById.mockResolvedValue(rootCategoryDoc);

    await expect(deleteCategory(categoryId)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Alt kategori bulunduğu için silinemez',
    });
  });

  it('kategoride ürün varsa 409 fırlatır', async () => {
    mockProductCountDocuments.mockResolvedValue(2);

    await expect(deleteCategory(categoryId)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Bu kategoride ürün bulunduğu için silinemez',
    });
  });

  it('ürün ve alt kategori yoksa kategoriyi siler', async () => {
    mockProductCountDocuments.mockResolvedValue(0);

    await deleteCategory(categoryId);

    expect(mockCategoryFindByIdAndDelete).toHaveBeenCalledWith(categoryId);
  });
});

describe('updateCategory', () => {
  beforeEach(() => {
    clearMemoryCache();
    vi.clearAllMocks();
    mockCategoryFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([rootCategoryDoc, childCategoryDoc]),
      }),
    });
    mockCategoryUpdateMany.mockResolvedValue({ modifiedCount: 2 });
    mockProductUpdateMany.mockResolvedValue({ modifiedCount: 3 });
  });

  it('isActive false yapınca alt kategorileri ve ürünleri pasifleştirir', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    mockCategoryFindById.mockResolvedValue({
      ...rootCategoryDoc,
      isActive: true,
      save,
      toObject: () => rootCategoryDoc,
    });

    await updateCategory(categoryId, { isActive: false });

    expect(mockCategoryUpdateMany).toHaveBeenCalledWith(
      { _id: { $in: [categoryId, childCategoryId] } },
      { $set: { isActive: false } }
    );
    expect(mockProductUpdateMany).toHaveBeenCalledWith(
      { categoryId: { $in: [categoryId, childCategoryId] } },
      { $set: { isActive: false } }
    );
    expect(save).toHaveBeenCalled();
  });
});
