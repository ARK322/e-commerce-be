import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '@/domains/identity/application/access/admin/permission-keys';
import { signAuthToken } from '@/domains/identity/application/tokens/access-token';
import { buildApp } from '@/app/app';

const mockListAdminCategories = vi.fn();
const mockLinkCategory = vi.fn();
const mockUnlinkCategory = vi.fn();
const mockCreateCategory = vi.fn();
const mockGetAdminContext = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/api/admin/categories/admin-categories.service', () => ({
  listAdminCategories: (...args: unknown[]) => mockListAdminCategories(...args),
  linkCategory: (...args: unknown[]) => mockLinkCategory(...args),
  createCategory: (...args: unknown[]) => mockCreateCategory(...args),
  getCategoryById: vi.fn(),
  updateCategory: vi.fn(),
  unlinkCategory: (...args: unknown[]) => mockUnlinkCategory(...args),
  deleteCategory: vi.fn(),
}));

vi.mock('@/domains/identity/application/queries/admin-context', () => ({
  getAdminContext: (...args: unknown[]) => mockGetAdminContext(...args),
}));

vi.mock('@/integrations/mongo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/integrations/mongo')>();
  return {
    ...actual,
    User: {
      ...actual.User,
      findById: (...args: unknown[]) => mockUserFindById(...args),
    },
    RevokedToken: {
      ...actual.RevokedToken,
      exists: (...args: unknown[]) => mockRevokedTokenExists(...args),
    },
  };
});

const adminId = '550e8400-e29b-41d4-a716-446655440000';
const categoryId = '660e8400-e29b-41d4-a716-446655440000';
const childId = '770e8400-e29b-41d4-a716-446655440000';

const mockAdminAuth = () => {
  mockUserFindById.mockImplementation((id: string) => {
    if (id === adminId) {
      return {
        select: vi.fn().mockResolvedValue({
          _id: adminId,
          role: 'admin',
          passwordChangedAt: null,
          sessionsRevokedAt: null,
        }),
      };
    }

    return {
      select: vi.fn().mockResolvedValue({ role: 'admin' }),
    };
  });
  mockGetAdminContext.mockResolvedValue({
    userId: adminId,
    roleId: '880e8400-e29b-41d4-a716-446655440000',
    roleSlug: 'owner',
    roleName: 'Owner',
    permissions: new Set(Object.values(PERMISSIONS)),
    isOwner: true,
  });
};

describe('category admin routes integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-jwt-secret-with-32-chars-minimum';
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRevokedTokenExists.mockResolvedValue(null);
  });

  it('GET /auth/admin/categories token olmadan 401 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/admin/categories' });

    expect(response.statusCode).toBe(401);
  });

  it('GET /auth/admin/categories admin token ile kategori listesi döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockListAdminCategories.mockResolvedValue([
      { id: categoryId, name: 'Elektronik', slug: 'elektronik', isLeaf: true },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/auth/admin/categories',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      categories: [{ id: categoryId, name: 'Elektronik', slug: 'elektronik', isLeaf: true }],
    });
  });

  it('POST /auth/admin/categories/:id/links parent bağlantısı ekler', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockLinkCategory.mockResolvedValue({
      message: 'Kategori bağlantısı eklendi',
      category: { id: childId, name: 'Telefon', parentIds: [categoryId] },
      orphanedProductCount: 0,
    });

    const response = await app.inject({
      method: 'POST',
      url: `/auth/admin/categories/${childId}/links`,
      headers: { authorization: `Bearer ${token}` },
      payload: { parentId: categoryId },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      message: 'Kategori bağlantısı eklendi',
      category: { id: childId },
      orphanedProductCount: 0,
    });
    expect(mockLinkCategory).toHaveBeenCalledWith(childId, { parentId: categoryId });
  });

  it('POST /auth/admin/categories/:id/links geçersiz body ile 400 döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();

    const response = await app.inject({
      method: 'POST',
      url: `/auth/admin/categories/${childId}/links`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: 'Geçersiz istek verisi' });
  });

  it('DELETE /auth/admin/categories/:id/links parent bağlantısını kaldırır', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockUnlinkCategory.mockResolvedValue({
      id: childId,
      name: 'Telefon',
      parentIds: [],
    });

    const response = await app.inject({
      method: 'DELETE',
      url: `/auth/admin/categories/${childId}/links`,
      headers: { authorization: `Bearer ${token}` },
      payload: { parentId: categoryId },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      message: 'Kategori bağlantısı kaldırıldı',
      category: { id: childId },
    });
    expect(mockUnlinkCategory).toHaveBeenCalledWith(childId, { parentId: categoryId });
  });

  it('POST /auth/admin/categories yeni kategori oluşturur', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockCreateCategory.mockResolvedValue({
      id: categoryId,
      name: 'Elektronik',
      slug: 'elektronik',
      isLeaf: true,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/admin/categories',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Elektronik', slug: 'elektronik' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      message: 'Kategori oluşturuldu',
      category: { name: 'Elektronik', slug: 'elektronik' },
    });
  });
});
