import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '@/domain/auth/access/admin/permission-keys';
import { signAuthToken } from '@/domain/auth/tokens/access-token';
import { buildApp } from '@/app/app';

const mockListAdminOrdersLean = vi.fn();
const mockGetAdminContext = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/repositories/buyers/order.repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/repositories/buyers/order.repository')>();
  return {
    ...actual,
    listAdminOrdersLean: (...args: unknown[]) => mockListAdminOrdersLean(...args),
  };
});

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

const mockAdminAuth = (permissions: Set<string>) => {
  mockUserFindById.mockImplementation((id: string) => ({
    select: vi.fn().mockResolvedValue({
      _id: id,
      role: 'admin',
      passwordChangedAt: null,
      sessionsRevokedAt: null,
    }),
  }));
  mockGetAdminContext.mockResolvedValue({
    userId: adminId,
    roleId: '880e8400-e29b-41d4-a716-446655440000',
    roleSlug: 'ops',
    roleName: 'Ops',
    permissions,
    isOwner: false,
  });
};

describe('admin orders routes integration', () => {
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

  it('orders.read yetkisi olmadan 403 döner', async () => {
    mockAdminAuth(new Set([PERMISSIONS.SELLERS_READ]));
    const token = signAuthToken(adminId, 'admin');

    const response = await app.inject({
      method: 'GET',
      url: '/auth/admin/orders',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('GET /auth/admin/orders sipariş listesi döner', async () => {
    mockAdminAuth(new Set([PERMISSIONS.ORDERS_READ]));
    const token = signAuthToken(adminId, 'admin');
    mockListAdminOrdersLean.mockResolvedValue({
      items: [
        {
          _id: '8c9e6679-7425-40de-944b-e07fc1f90ae8',
          buyerId: 'buyer-1',
          items: [{ sellerId: 'seller-1' }],
          totalAmount: 250,
          currency: 'TRY',
          status: 'paid',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      total: 1,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/admin/orders',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.total).toBe(1);
    expect(body.items[0].sellerIds).toEqual(['seller-1']);
  });
});
