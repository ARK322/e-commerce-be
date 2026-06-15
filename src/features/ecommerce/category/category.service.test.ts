import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCategoryFind = vi.fn();
const mockCategoryFindById = vi.fn();
const mockCategoryCreate = vi.fn();
const mockCategoryFindByIdAndDelete = vi.fn();
const mockCategoryCountDocuments = vi.fn();
const mockProductCountDocuments = vi.fn();

vi.mock('@/db', () => ({
  Category: {
    find: (...args: unknown[]) => mockCategoryFind(...args),
    findById: (...args: unknown[]) => mockCategoryFindById(...args),
    create: (...args: unknown[]) => mockCategoryCreate(...args),
    findByIdAndDelete: (...args: unknown[]) => mockCategoryFindByIdAndDelete(...args),
    countDocuments: (...args: unknown[]) => mockCategoryCountDocuments(...args),
  },
  Product: {
    countDocuments: (...args: unknown[]) => mockProductCountDocuments(...args),
  },
}));

vi.mock('@/lib/common/user-id', () => ({
  createUserId: () => '7c9e6679-7425-40de-944b-e07fc1f90ae7',
}));

import {
  createCategory,
  deleteCategory,
  getCategoryById,
  listPublicCategories,
  updateCategory,
} from '@/features/ecommerce/category/category.service';

const categoryId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const childCategoryId = '8d9e6679-7425-40de-944b-e07fc1f90ae8';

const rootCategoryDoc = {
  _id: categoryId,
  parentId: null,
  name: 'Elektronik',
  slug: 'elektronik',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const childCategoryDoc = {
  _id: childCategoryId,
  parentId: categoryId,
  name: 'Telefon',
  slug: 'telefon',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('listPublicCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCategoryFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([rootCategoryDoc, childCategoryDoc]),
    });
  });

  it('ağaç yapısında public kategorileri döner', async () => {
    const result = await listPublicCategories();

    expect(result).toEqual([
      {
        id: categoryId,
        parentId: null,
        name: 'Elektronik',
        slug: 'elektronik',
        children: [
          {
            id: childCategoryId,
            parentId: categoryId,
            name: 'Telefon',
            slug: 'telefon',
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
          { _id: categoryId, parentId: null, isActive: true },
          { _id: childCategoryId, parentId: categoryId, isActive: true },
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

  it('childCount ile kategori detayı döner', async () => {
    mockCategoryFindById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(rootCategoryDoc),
    });

    const result = await getCategoryById(categoryId);

    expect(result).toMatchObject({
      id: categoryId,
      parentId: null,
      childCount: 1,
    });
  });
});

describe('createCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCategoryCreate.mockResolvedValue({
      toObject: () => rootCategoryDoc,
    });
  });

  it('parentId ile alt kategori oluşturur', async () => {
    mockCategoryFindById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(rootCategoryDoc),
    });
    mockCategoryCreate.mockResolvedValue({
      toObject: () => childCategoryDoc,
    });

    const result = await createCategory({
      name: 'Telefon',
      parentId: categoryId,
    });

    expect(mockCategoryCreate).toHaveBeenCalledWith({
      _id: categoryId,
      parentId: categoryId,
      name: 'Telefon',
      slug: 'telefon',
      isActive: true,
    });
    expect(result.parentId).toBe(categoryId);
  });
});

describe('updateCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCategoryFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([{ _id: categoryId, parentId: null, isActive: true }]),
      }),
    });
  });

  it('kategori yoksa 404 fırlatır', async () => {
    mockCategoryFindById.mockResolvedValue(null);

    await expect(updateCategory(categoryId, { name: 'Yeni ad' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('kendi altına taşımayı engeller', async () => {
    mockCategoryFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { _id: categoryId, parentId: null, isActive: true },
          { _id: childCategoryId, parentId: categoryId, isActive: true },
        ]),
      }),
    });

    mockCategoryFindById.mockImplementation((id: string) => {
      if (id === categoryId) {
        return Promise.resolve({
          ...rootCategoryDoc,
          save: vi.fn(),
          toObject: () => rootCategoryDoc,
        });
      }

      return {
        lean: vi.fn().mockResolvedValue({
          _id: childCategoryId,
          parentId: categoryId,
        }),
      };
    });

    await expect(
      updateCategory(categoryId, { parentId: childCategoryId })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Kategori kendi alt ağacına taşınamaz',
    });
  });
});

describe('deleteCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCategoryFindById.mockResolvedValue(rootCategoryDoc);
  });

  it('alt kategori varsa 409 fırlatır', async () => {
    mockCategoryCountDocuments.mockResolvedValue(1);

    await expect(deleteCategory(categoryId)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Alt kategori bulunduğu için silinemez',
    });
  });

  it('kategoride ürün varsa 409 fırlatır', async () => {
    mockCategoryCountDocuments.mockResolvedValue(0);
    mockProductCountDocuments.mockResolvedValue(2);

    await expect(deleteCategory(categoryId)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Bu kategoride ürün bulunduğu için silinemez',
    });
  });

  it('ürün ve alt kategori yoksa kategoriyi siler', async () => {
    mockCategoryCountDocuments.mockResolvedValue(0);
    mockProductCountDocuments.mockResolvedValue(0);

    await deleteCategory(categoryId);

    expect(mockCategoryFindByIdAndDelete).toHaveBeenCalledWith(categoryId);
  });
});
