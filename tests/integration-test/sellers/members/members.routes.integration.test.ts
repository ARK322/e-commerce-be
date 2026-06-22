import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SELLER_PERMISSIONS } from '@/domains/identity/application/access/seller/permission-keys';
import type { SellerAccessContext } from '@/domains/identity/application/queries/seller-context';
import { signAuthToken } from '@/domains/identity/application/tokens/access-token';
import { buildApp } from '@/app/app';

const mockListSellerMembers = vi.fn();
const mockCreateSellerMember = vi.fn();
const mockGetSellerContext = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/api/seller/members/members.service', () => ({
  listSellerMembers: (...args: unknown[]) => mockListSellerMembers(...args),
  createSellerMember: (...args: unknown[]) => mockCreateSellerMember(...args),
  getSellerMemberByUserId: vi.fn(),
  updateSellerMemberRole: vi.fn(),
  updateSellerMemberProfile: vi.fn(),
  deleteSellerMember: vi.fn(),
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

describe('seller members routes integration', () => {
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

  it('GET /auth/seller/members token olmadan 401 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/seller/members' });

    expect(response.statusCode).toBe(401);
  });

  it('GET /auth/seller/members ekip listesi döner', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockVerifiedSeller();
    mockListSellerMembers.mockResolvedValue([
      {
        userId: sellerId,
        email: 'owner@test.com',
        isOwner: true,
        profile: { firstName: 'Ali', lastName: 'Veli', phone: null },
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/auth/seller/members',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      members: [
        {
          userId: sellerId,
          email: 'owner@test.com',
          isOwner: true,
          profile: { firstName: 'Ali', lastName: 'Veli', phone: null },
        },
      ],
    });
  });

  it('POST /auth/seller/members geçersiz body ile 400 döner', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockVerifiedSeller();

    const response = await app.inject({
      method: 'POST',
      url: '/auth/seller/members',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'not-an-email' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: 'Geçersiz istek verisi' });
  });

  it('POST /auth/seller/members owner yeni çalışan ekler', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockVerifiedSeller();
    mockCreateSellerMember.mockResolvedValue({
      userId: '660e8400-e29b-41d4-a716-446655440000',
      email: 'member@test.com',
      roleId,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/seller/members',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        email: 'member@test.com',
        roleId,
        firstName: 'Ayşe',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      message: 'Çalışan eklendi',
      email: 'member@test.com',
      roleId,
    });
  });
});
