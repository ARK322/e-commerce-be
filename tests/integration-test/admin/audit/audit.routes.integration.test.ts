import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '@/domain/auth/access/admin/permission-keys';
import { signAuthToken } from '@/domain/auth/tokens/access-token';
import { buildApp } from '@/app/app';
import { TEST_JWT_SECRET } from '../../../helpers/jwt-secret';

const mockListAdminAuditLogs = vi.fn();
const mockGetAdminContext = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/features/admin/audit/audit.service', () => ({
  listAdminAuditLogs: (...args: unknown[]) => mockListAdminAuditLogs(...args),
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

    return { select: vi.fn().mockResolvedValue({ role: 'admin' }) };
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

describe('admin audit routes integration', () => {
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

  it('GET /auth/admin/audit-logs token olmadan 401 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/admin/audit-logs' });

    expect(response.statusCode).toBe(401);
  });

  it('GET /auth/admin/audit-logs denetim kayıtları döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockListAdminAuditLogs.mockResolvedValue({
      items: [{ id: 'log-1', action: 'seller.approved' }],
      total: 1,
      page: 1,
      limit: 20,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/admin/audit-logs?page=1&limit=20',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ total: 1 });
  });
});
