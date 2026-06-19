import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '@/internal/auth/access/admin/permission-keys';
import { signAuthToken } from '@/internal/auth/tokens/access-token';
import { buildApp } from '@/app/app';

const mockListAdmins = vi.fn();
const mockCreateAdmin = vi.fn();
const mockGetAdminContext = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/features/auth/admin/admins/admins.service', () => ({
  listAdmins: (...args: unknown[]) => mockListAdmins(...args),
  createAdmin: (...args: unknown[]) => mockCreateAdmin(...args),
  getAdminByUserId: vi.fn(),
  updateAdmin: vi.fn(),
  deleteAdmin: vi.fn(),
}));

vi.mock('@/internal/auth/queries/admin-context', () => ({
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
const roleId = '660e8400-e29b-41d4-a716-446655440000';

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
    roleId,
    roleSlug: 'owner',
    roleName: 'Owner',
    permissions: new Set(Object.values(PERMISSIONS)),
    isOwner: true,
  });
};

describe('admin admins routes integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-secret';
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRevokedTokenExists.mockResolvedValue(null);
  });

  it('GET /auth/admin/admins token olmadan 401 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/admin/admins' });

    expect(response.statusCode).toBe(401);
  });

  it('GET /auth/admin/admins owner admin listesi döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockListAdmins.mockResolvedValue([
      { userId: adminId, email: 'owner@test.com', role: { slug: 'owner' } },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/auth/admin/admins',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().admins).toHaveLength(1);
  });

  it('POST /auth/admin/admins geçersiz body ile 400 döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();

    const response = await app.inject({
      method: 'POST',
      url: '/auth/admin/admins',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'bad' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: 'Geçersiz istek verisi' });
  });

  it('POST /auth/admin/admins owner yeni admin oluşturur', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockCreateAdmin.mockResolvedValue({
      userId: '770e8400-e29b-41d4-a716-446655440000',
      email: 'newadmin@test.com',
      roleId,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/admin/admins',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        email: 'newadmin@test.com',
        password: 'Test1234!',
        roleId,
        firstName: 'Ali',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      message: 'Admin oluşturuldu',
      email: 'newadmin@test.com',
    });
  });
});
