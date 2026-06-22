import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '@/domains/identity/application/access/admin/permission-keys';
import { signAuthToken } from '@/domains/identity/application/tokens/access-token';
import { buildApp } from '@/app/app';

const mockGetAdminProfile = vi.fn();
const mockUpdateAdminProfile = vi.fn();
const mockGetAdminContext = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/api/admin/profile/profile.service', () => ({
  getAdminProfile: (...args: unknown[]) => mockGetAdminProfile(...args),
  updateAdminProfile: (...args: unknown[]) => mockUpdateAdminProfile(...args),
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
    roleId: '660e8400-e29b-41d4-a716-446655440000',
    roleSlug: 'owner',
    roleName: 'Owner',
    permissions: new Set(Object.values(PERMISSIONS)),
    isOwner: true,
  });
};

describe('admin profile routes integration', () => {
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

  it('GET /auth/admin/profile token olmadan 401 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/admin/profile' });

    expect(response.statusCode).toBe(401);
  });

  it('GET /auth/admin/profile admin profili döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockGetAdminProfile.mockResolvedValue({
      userId: adminId,
      email: 'admin@test.com',
      profile: { firstName: 'Ali', lastName: 'Veli', phone: null },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/admin/profile',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      email: 'admin@test.com',
      profile: { firstName: 'Ali' },
    });
  });

  it('PATCH /auth/admin/profile geçersiz body ile 400 döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();

    const response = await app.inject({
      method: 'PATCH',
      url: '/auth/admin/profile',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: 'Geçersiz istek verisi' });
  });

  it('PATCH /auth/admin/profile profili günceller', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockUpdateAdminProfile.mockResolvedValue({
      userId: adminId,
      email: 'admin@test.com',
      profile: { firstName: 'Mehmet', lastName: 'Veli', phone: null },
    });

    const response = await app.inject({
      method: 'PATCH',
      url: '/auth/admin/profile',
      headers: { authorization: `Bearer ${token}` },
      payload: { firstName: 'Mehmet' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      message: 'Profil güncellendi',
      profile: { firstName: 'Mehmet' },
    });
  });
});
