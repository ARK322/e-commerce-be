import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '@/domains/identity/application/access/admin/permission-keys';
import { signAuthToken } from '@/domains/identity/application/tokens/access-token';
import { buildApp } from '@/app/app';

const mockListAdminRoles = vi.fn();
const mockCreateAdminRole = vi.fn();
const mockGetAdminContext = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/api/admin/roles/roles.service', () => ({
  listAdminRoles: (...args: unknown[]) => mockListAdminRoles(...args),
  createAdminRole: (...args: unknown[]) => mockCreateAdminRole(...args),
  listPermissionRegistry: () => [{ key: PERMISSIONS.CATEGORIES_READ, label: 'Kategori görüntüle', ownerOnly: false }],
  listAssignableRoles: vi.fn(),
  getAdminRoleById: vi.fn(),
  updateAdminRole: vi.fn(),
  deleteAdminRole: vi.fn(),
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

describe('admin roles routes integration', () => {
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

  it('GET /auth/admin/roles token olmadan 401 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/admin/roles' });

    expect(response.statusCode).toBe(401);
  });

  it('GET /auth/admin/roles admin ile rol listesi döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockListAdminRoles.mockResolvedValue([
      { roleId: '660e8400-e29b-41d4-a716-446655440000', name: 'Owner', slug: 'owner' },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/auth/admin/roles',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().roles).toHaveLength(1);
  });

  it('GET /auth/admin/roles/permissions kayıt döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();

    const response = await app.inject({
      method: 'GET',
      url: '/auth/admin/roles/permissions',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().permissions[0]).toMatchObject({
      key: PERMISSIONS.CATEGORIES_READ,
    });
  });

  it('POST /auth/admin/roles owner yeni rol oluşturur', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockCreateAdminRole.mockResolvedValue({
      roleId: '770e8400-e29b-41d4-a716-446655440000',
      name: 'Moderator',
      slug: 'moderator',
      permissions: [PERMISSIONS.CATEGORIES_READ],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/admin/roles',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Moderator',
        slug: 'moderator',
        permissions: [PERMISSIONS.CATEGORIES_READ],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      message: 'Rol oluşturuldu',
      slug: 'moderator',
    });
  });
});
