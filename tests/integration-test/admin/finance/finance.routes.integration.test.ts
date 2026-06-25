import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '@/domain/auth/access/admin/permission-keys';
import { signAuthToken } from '@/domain/auth/tokens/access-token';
import { buildApp } from '@/app/app';

const mockGetFinanceSummary = vi.fn();
const mockGetFinanceBySeller = vi.fn();
const mockExportFinanceSplitsCsv = vi.fn();
const mockGetAdminContext = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/features/admin/finance/finance.service', () => ({
  getFinanceSummary: (...args: unknown[]) => mockGetFinanceSummary(...args),
  getFinanceBySeller: (...args: unknown[]) => mockGetFinanceBySeller(...args),
  exportFinanceSplitsCsv: (...args: unknown[]) => mockExportFinanceSplitsCsv(...args),
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

const financeAdminContext = {
  userId: adminId,
  roleId: '770e8400-e29b-41d4-a716-446655440000',
  roleSlug: 'finance',
  roleName: 'Finance',
  permissions: new Set([PERMISSIONS.FINANCE_READ, PERMISSIONS.FINANCE_EXPORT]),
  isOwner: false,
};

const mockAdminAuth = (permissions = financeAdminContext.permissions) => {
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
    ...financeAdminContext,
    permissions,
  });
};

describe('admin finance routes integration', () => {
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

  it('GET /auth/admin/finance/summary token olmadan 401 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/admin/finance/summary' });

    expect(response.statusCode).toBe(401);
  });

  it('GET /auth/admin/finance/summary finans özeti döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockGetFinanceSummary.mockResolvedValue({
      totalSubtotal: 1000,
      totalCommission: 100,
      totalSellerShare: 900,
      splitCount: 5,
      from: null,
      to: null,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/admin/finance/summary',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ splitCount: 5, totalSubtotal: 1000 });
  });

  it('GET /auth/admin/finance/export yetkisiz admin 403 döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth(new Set([PERMISSIONS.FINANCE_READ]));

    const response = await app.inject({
      method: 'GET',
      url: '/auth/admin/finance/export',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('GET /auth/admin/finance/export CSV döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockExportFinanceSplitsCsv.mockResolvedValue('orderId,productId\no1,p1');

    const response = await app.inject({
      method: 'GET',
      url: '/auth/admin/finance/export',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.body).toContain('orderId');
  });

  it('GET /auth/admin/finance/by-seller satıcı bazlı rapor döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockGetFinanceBySeller.mockResolvedValue({
      items: [{ sellerId: 's1', totalSellerShare: 500 }],
      total: 1,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/admin/finance/by-seller',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ total: 1 });
    expect(mockGetFinanceBySeller).toHaveBeenCalled();
  });
});
