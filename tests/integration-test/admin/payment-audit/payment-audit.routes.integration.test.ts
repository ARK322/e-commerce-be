import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '@/internal/auth/access/admin/permission-keys';
import { signAuthToken } from '@/internal/auth/tokens/access-token';
import { buildApp } from '@/app/app';

const mockListPaymentAuditLogsByOrderIdLean = vi.fn();
const mockGetAdminContext = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/repositories/buyers/payment-audit-log.repository', () => ({
  listPaymentAuditLogsByOrderIdLean: (...args: unknown[]) =>
    mockListPaymentAuditLogsByOrderIdLean(...args),
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
const orderId = '8c9e6679-7425-40de-944b-e07fc1f90ae8';

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

describe('payment audit admin routes integration', () => {
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

  it('GET /auth/admin/payment-audit-logs orderId ile kayıt döner', async () => {
    mockAdminAuth();
    const token = signAuthToken(adminId, 'admin');
    mockListPaymentAuditLogsByOrderIdLean.mockResolvedValue({
      items: [
        {
          _id: 'audit-1',
          paymentId: 'pay-1',
          orderId,
          fromStatus: 'pending',
          toStatus: 'processing',
          reason: 'callback_claim',
          metadata: null,
          createdAt: new Date('2026-01-01'),
        },
      ],
      total: 1,
    });

    const response = await app.inject({
      method: 'GET',
      url: `/auth/admin/payment-audit-logs?orderId=${orderId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      items: [{ orderId, fromStatus: 'pending', toStatus: 'processing' }],
      total: 1,
    });
  });

  it('filtre olmadan 400 döner', async () => {
    mockAdminAuth();
    const token = signAuthToken(adminId, 'admin');

    const response = await app.inject({
      method: 'GET',
      url: '/auth/admin/payment-audit-logs',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(400);
    expect(mockListPaymentAuditLogsByOrderIdLean).not.toHaveBeenCalled();
  });
});
