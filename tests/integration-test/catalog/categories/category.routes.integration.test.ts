import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '@/app/app';

const mockListPublicCategories = vi.fn();
const mockGetPublicCategoryById = vi.fn();
const mockGetCategoryPaths = vi.fn();

vi.mock('@/features/catalog/categories/category.service', () => ({
  listPublicCategories: (...args: unknown[]) => mockListPublicCategories(...args),
  getPublicCategoryById: (...args: unknown[]) => mockGetPublicCategoryById(...args),
  getCategoryPaths: (...args: unknown[]) => mockGetCategoryPaths(...args),
}));

const categoryId = '550e8400-e29b-41d4-a716-446655440000';

describe('category routes integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /categories public liste döner', async () => {
    mockListPublicCategories.mockResolvedValue([
      { id: categoryId, name: 'Elektronik', slug: 'elektronik', isLeaf: true },
    ]);

    const response = await app.inject({ method: 'GET', url: '/categories' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      categories: [{ id: categoryId, name: 'Elektronik', slug: 'elektronik', isLeaf: true }],
    });
  });

  it('GET /categories/:id geçersiz uuid ile 400 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/categories/not-a-uuid' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: 'Geçersiz adres parametresi' });
  });

  it('GET /categories/:id aktif kategori döner', async () => {
    mockGetPublicCategoryById.mockResolvedValue({
      id: categoryId,
      name: 'Elektronik',
      slug: 'elektronik',
      isLeaf: true,
      parentIds: [],
      childIds: [],
      paths: [[categoryId]],
    });

    const response = await app.inject({ method: 'GET', url: `/categories/${categoryId}` });

    expect(response.statusCode).toBe(200);
    expect(response.json().category.id).toBe(categoryId);
  });

  it('GET /categories/:id pasif kategori için 404 döner', async () => {
    const { CommerceError } = await import('@/shared/errors/commerce-error');
    mockGetPublicCategoryById.mockRejectedValue(new CommerceError(404, 'Kategori bulunamadı'));

    const response = await app.inject({ method: 'GET', url: `/categories/${categoryId}` });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ message: 'Kategori bulunamadı' });
  });

  it('GET /categories/:id/paths yolları döner', async () => {
    mockGetCategoryPaths.mockResolvedValue([[categoryId]]);

    const response = await app.inject({
      method: 'GET',
      url: `/categories/${categoryId}/paths`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ categoryId, paths: [[categoryId]] });
  });
});
