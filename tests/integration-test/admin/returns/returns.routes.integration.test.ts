import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '@/domain/auth/access/admin/permission-keys';
import { signAuthToken } from '@/domain/auth/tokens/access-token';
import { buildApp } from '@/app/app';

const mockListAdminReturnRequests = vi.fn();
const mockReviewAdminReturnRequest = vi.fn();
const mockGetAdminContext = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/features/admin/returns/returns.service', () => ({
  listAdminReturnRequests: (...args: unknown[]) => mockListAdminReturnRequests(...args),
  reviewAdminReturnRequest: (...args: unknown[]) => mockReviewAdminReturnRequest(...args),
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
const requestId = '8c9e6679-7425-40de-944b-e07fc1f90ae8';

const returnsAdminContext = {
  userId: adminId,
  roleId: '770e8400-e29b-41d4-a716-446655440000',
  roleSlug: 'ops',
  roleName: 'Ops',
  permissions: new Set([PERMISSIONS.RETURNS_READ, PERMISSIONS.RETURNS_WRITE]),
  isOwner: false,
};

const mockAdminAuth = (permissions = returnsAdminContext.permissions) => {
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
    ...returnsAdminContext,
    permissions,
  });
};

describe('admin returns routes integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? 'integration-test-jwt-secret-with-32-chars-minimum';
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRevokedTokenExists.mockResolvedValue(null);
  });

  it('GET /auth/admin/returns token olmadan 401 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/admin/returns' });

    expect(response.statusCode).toBe(401);
  });

  it('GET /auth/admin/returns liste döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockListAdminReturnRequests.mockResolvedValue({
      items: [{ id: requestId, status: 'pending' }],
      total: 1,
      page: 1,
      limit: 20,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/admin/returns?page=1&limit=20',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ total: 1 });
  });

  it('PATCH /auth/admin/returns/:requestId yazma yetkisi olmadan 403 döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth(new Set([PERMISSIONS.RETURNS_READ]));

    const response = await app.inject({
      method: 'PATCH',
      url: `/auth/admin/returns/${requestId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { decision: 'rejected' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('PATCH /auth/admin/returns/:requestId talebi günceller', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockReviewAdminReturnRequest.mockResolvedValue({
      id: requestId,
      status: 'rejected',
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/auth/admin/returns/${requestId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { decision: 'rejected', adminNote: 'Uygun değil' },
    });

    expect(response.statusCode).toBe(200);
    expect(mockReviewAdminReturnRequest).toHaveBeenCalled();
  });

  it('PATCH /auth/admin/returns/:requestId onay kararı gönderir', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockReviewAdminReturnRequest.mockResolvedValue({
      id: requestId,
      status: 'approved',
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/auth/admin/returns/${requestId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { decision: 'approved', adminNote: 'Onaylandı' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      message: 'İade talebi güncellendi',
      returnRequest: { status: 'approved' },
    });
  });
});
