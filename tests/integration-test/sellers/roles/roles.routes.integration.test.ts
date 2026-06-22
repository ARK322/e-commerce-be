import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SELLER_PERMISSIONS } from '@/domains/identity/application/access/seller/permission-keys';
import type { SellerAccessContext } from '@/domains/identity/application/queries/seller-context';
import { signAuthToken } from '@/domains/identity/application/tokens/access-token';
import { buildApp } from '@/app/app';

const mockListSellerRoles = vi.fn();
const mockCreateSellerRole = vi.fn();
const mockGetSellerContext = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/api/seller/roles/roles.service', () => ({
  listSellerRoles: (...args: unknown[]) => mockListSellerRoles(...args),
  createSellerRole: (...args: unknown[]) => mockCreateSellerRole(...args),
  listSellerPermissionRegistry: () => [{ key: SELLER_PERMISSIONS.PRODUCTS_READ, label: 'Ürün görüntüle' }],
  listAssignableSellerRoles: vi.fn(),
  getSellerRoleById: vi.fn(),
  updateSellerRole: vi.fn(),
  deleteSellerRole: vi.fn(),
}));

vi.mock('@/domains/identity/application/queries/seller-context', () => ({
  getSellerContext: (...args: unknown[]) => mockGetSellerContext(...args),
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

const sellerId = '550e8400-e29b-41d4-a716-446655440000';
const companyId = sellerId;
const roleId = '770e8400-e29b-41d4-a716-446655440000';

const sellerContext: SellerAccessContext = {
  userId: sellerId,
  companyId,
  companyName: 'Test A.Ş.',
  sellerType: 'kurumsal',
  approvalStatus: 'approved',
  roleId,
  roleSlug: 'owner',
  roleName: 'Owner',
  permissions: new Set(Object.values(SELLER_PERMISSIONS)),
  isOwner: true,
  teamManagementEnabled: true,
  member: { firstName: 'Ali', lastName: 'Veli', phone: null },
};

const mockVerifiedSeller = () => {
  mockUserFindById.mockImplementation((id: string) => {
    if (id === sellerId) {
      return {
        select: vi.fn().mockResolvedValue({
          _id: sellerId,
          role: 'seller',
          isEmailVerified: true,
          passwordChangedAt: null,
          sessionsRevokedAt: null,
        }),
      };
    }

    return {
      select: vi.fn().mockResolvedValue({ isEmailVerified: true, role: 'seller' }),
    };
  });
  mockGetSellerContext.mockResolvedValue(sellerContext);
};

describe('seller roles routes integration', () => {
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

  it('GET /auth/seller/roles token olmadan 401 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/seller/roles' });

    expect(response.statusCode).toBe(401);
  });

  it('GET /auth/seller/roles rol listesi döner', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockVerifiedSeller();
    mockListSellerRoles.mockResolvedValue([
      { roleId, name: 'Owner', slug: 'owner', isSystem: true },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/auth/seller/roles',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      roles: [{ roleId, name: 'Owner', slug: 'owner', isSystem: true }],
    });
  });

  it('GET /auth/seller/roles/permissions kayıt döner', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockVerifiedSeller();

    const response = await app.inject({
      method: 'GET',
      url: '/auth/seller/roles/permissions',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().permissions).toEqual([
      { key: SELLER_PERMISSIONS.PRODUCTS_READ, label: 'Ürün görüntüle' },
    ]);
  });

  it('POST /auth/seller/roles geçersiz body ile 400 döner', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockVerifiedSeller();

    const response = await app.inject({
      method: 'POST',
      url: '/auth/seller/roles',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'X', slug: 'INVALID SLUG', permissions: [] },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: 'Geçersiz istek verisi' });
  });

  it('POST /auth/seller/roles owner yeni rol oluşturur', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockVerifiedSeller();
    mockCreateSellerRole.mockResolvedValue({
      roleId: '880e8400-e29b-41d4-a716-446655440000',
      name: 'Depo',
      slug: 'depo',
      permissions: [SELLER_PERMISSIONS.PRODUCTS_READ],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/seller/roles',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Depo',
        slug: 'depo',
        permissions: [SELLER_PERMISSIONS.PRODUCTS_READ],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      message: 'Rol oluşturuldu',
      name: 'Depo',
      slug: 'depo',
    });
  });
});
