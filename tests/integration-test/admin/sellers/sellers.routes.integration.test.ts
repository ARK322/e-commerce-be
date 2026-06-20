import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '@/internal/auth/access/admin/permission-keys';
import { signAuthToken } from '@/internal/auth/tokens/access-token';
import { buildApp } from '@/app/app';

const mockListSellers = vi.fn();
const mockApproveSeller = vi.fn();
const mockRejectSeller = vi.fn();
const mockGetAdminContext = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/features/admin/sellers/sellers.service', () => ({
  listSellers: (...args: unknown[]) => mockListSellers(...args),
  approveSeller: (...args: unknown[]) => mockApproveSeller(...args),
  rejectSeller: (...args: unknown[]) => mockRejectSeller(...args),
  getSellerByUserId: vi.fn(),
  syncSellerIyzicoSubMerchant: vi.fn(),
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
const sellerUserId = '660e8400-e29b-41d4-a716-446655440000';

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
    roleId: '770e8400-e29b-41d4-a716-446655440000',
    roleSlug: 'owner',
    roleName: 'Owner',
    permissions: new Set(Object.values(PERMISSIONS)),
    isOwner: true,
  });
};

describe('admin sellers routes integration', () => {
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

  it('GET /auth/admin/sellers token olmadan 401 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/admin/sellers' });

    expect(response.statusCode).toBe(401);
  });

  it('GET /auth/admin/sellers admin ile satıcı listesi döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockListSellers.mockResolvedValue([
      { userId: sellerUserId, companyName: 'Test A.Ş.', approvalStatus: 'pending' },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/auth/admin/sellers?status=pending',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      sellers: [{ userId: sellerUserId, companyName: 'Test A.Ş.', approvalStatus: 'pending' }],
    });
  });

  it('POST /auth/admin/sellers/:userId/approve satıcıyı onaylar', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockApproveSeller.mockResolvedValue({
      userId: sellerUserId,
      approvalStatus: 'approved',
    });

    const response = await app.inject({
      method: 'POST',
      url: `/auth/admin/sellers/${sellerUserId}/approve`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      message: 'Satıcı onaylandı',
      userId: sellerUserId,
      approvalStatus: 'approved',
    });
  });

  it('POST /auth/admin/sellers/:userId/reject geçersiz body ile 400 döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();

    const response = await app.inject({
      method: 'POST',
      url: `/auth/admin/sellers/${sellerUserId}/reject`,
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'x' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: 'Geçersiz istek verisi' });
  });

  it('POST /auth/admin/sellers/:userId/reject satıcıyı reddeder', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockRejectSeller.mockResolvedValue({
      userId: sellerUserId,
      approvalStatus: 'rejected',
      rejectionReason: 'Eksik belgeler',
    });

    const response = await app.inject({
      method: 'POST',
      url: `/auth/admin/sellers/${sellerUserId}/reject`,
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'Eksik belgeler' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      message: 'Satıcı reddedildi',
      approvalStatus: 'rejected',
      rejectionReason: 'Eksik belgeler',
    });
  });
});
