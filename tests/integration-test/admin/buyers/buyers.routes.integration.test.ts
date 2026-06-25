import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '@/domain/auth/access/admin/permission-keys';
import { signAuthToken } from '@/domain/auth/tokens/access-token';
import { buildApp } from '@/app/app';
import { TEST_JWT_SECRET } from '../../../helpers/jwt-secret';

const mockListBuyers = vi.fn();
const mockGetBuyerById = vi.fn();
const mockGetAdminContext = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/features/admin/buyers/buyers.service', () => ({
  listBuyers: (...args: unknown[]) => mockListBuyers(...args),
  getBuyerById: (...args: unknown[]) => mockGetBuyerById(...args),
}));

vi.mock('@/domain/auth/queries/admin-context', () => ({
  getAdminContext: (...args: unknown[]) => mockGetAdminContext(...args),
}));

vi.mock('@/infrastructure/mongo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infrastructure/mongo')>();
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
const buyerUserId = '660e8400-e29b-41d4-a716-446655440001';

const mockAdminAuth = (permissions: Set<string> = new Set([PERMISSIONS.BUYERS_READ])) => {
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

    return { select: vi.fn().mockResolvedValue({ role: 'admin' }) };
  });
  mockGetAdminContext.mockResolvedValue({
    userId: adminId,
    roleId: '770e8400-e29b-41d4-a716-446655440000',
    roleSlug: 'ops',
    roleName: 'Ops',
    permissions,
    isOwner: false,
  });
};

describe('admin buyers routes integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? TEST_JWT_SECRET;
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRevokedTokenExists.mockResolvedValue(null);
  });

  it('GET /auth/admin/buyers token olmadan 401 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/admin/buyers' });

    expect(response.statusCode).toBe(401);
  });

  it('GET /auth/admin/buyers alıcı listesi döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockListBuyers.mockResolvedValue({
      items: [{ userId: buyerUserId, email: 'buyer@test.com' }],
      total: 1,
      page: 1,
      limit: 20,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/admin/buyers?page=1&limit=20',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ total: 1 });
  });

  it('GET /auth/admin/buyers/:userId alıcı detayı döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockGetBuyerById.mockResolvedValue({ userId: buyerUserId, email: 'buyer@test.com' });

    const response = await app.inject({
      method: 'GET',
      url: `/auth/admin/buyers/${buyerUserId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetBuyerById).toHaveBeenCalled();
  });

  it('GET /auth/admin/buyers yetkisiz admin 403 döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth(new Set([PERMISSIONS.ORDERS_READ]));

    const response = await app.inject({
      method: 'GET',
      url: '/auth/admin/buyers',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
  });
});
