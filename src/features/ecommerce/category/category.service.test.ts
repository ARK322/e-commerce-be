import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCategoryFind = vi.fn();
const mockCategoryFindById = vi.fn();
const mockCategoryCreate = vi.fn();
const mockCategoryFindByIdAndDelete = vi.fn();
const mockProductCountDocuments = vi.fn();

vi.mock('@/db', () => ({
  Category: {
    find: (...args: unknown[]) => mockCategoryFind(...args),
    findById: (...args: unknown[]) => mockCategoryFindById(...args),
    create: (...args: unknown[]) => mockCategoryCreate(...args),
    findByIdAndDelete: (...args: unknown[]) => mockCategoryFindByIdAndDelete(...args),
  },
  Product: {
    countDocuments: (...args: unknown[]) => mockProductCountDocuments(...args),
  },
}));

vi.mock('@/lib/common/user-id', () => ({
  createUserId: () => '7c9e6679-7425-40de-944b-e07fc1f90ae7',
}));

import {
  deleteCategory,
  getCategoryById,
  listPublicCategories,
} from '@/features/ecommerce/category/category.service';

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
