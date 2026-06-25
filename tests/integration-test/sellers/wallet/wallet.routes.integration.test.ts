import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SELLER_PERMISSIONS } from '@/domain/auth/access/seller/permission-keys';
import type { SellerAccessContext } from '@/domain/auth/queries/seller-context';
import { signAuthToken } from '@/domain/auth/tokens/access-token';
import { buildApp } from '@/app/app';
import { TEST_JWT_SECRET } from '../../../helpers/jwt-secret';

const mockGetSellerWalletForCompany = vi.fn();
const mockGetSellerContext = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/features/sellers/wallet/wallet.service', () => ({
  getSellerWalletForCompany: (...args: unknown[]) => mockGetSellerWalletForCompany(...args),
  getSellerWalletSummary: vi.fn(),
}));

vi.mock('@/domain/auth/queries/seller-context', () => ({
  getSellerContext: (...args: unknown[]) => mockGetSellerContext(...args),
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

const sellerId = '550e8400-e29b-41d4-a716-446655440000';

const sellerContext: SellerAccessContext = {
  userId: sellerId,
  companyId: sellerId,
  companyName: 'Test A.Ş.',
  sellerType: 'kurumsal',
  approvalStatus: 'approved',
  roleId: '770e8400-e29b-41d4-a716-446655440000',
  roleSlug: 'owner',
  roleName: 'Owner',
  permissions: new Set(Object.values(SELLER_PERMISSIONS)),
  isOwner: true,
  teamManagementEnabled: true,
  member: { firstName: null, lastName: null, phone: null },
};

const mockApprovedSeller = () => {
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

describe('seller wallet routes integration', () => {
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

  it('GET /auth/seller/wallet token olmadan 401 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/seller/wallet' });

    expect(response.statusCode).toBe(401);
  });

  it('GET /auth/seller/wallet cüzdan özeti döner', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockApprovedSeller();
    mockGetSellerWalletForCompany.mockResolvedValue({
      pendingBalance: 100,
      availableBalance: 50,
      currency: 'TRY',
      ledger: [],
      settlementNote: 'test',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/seller/wallet',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      wallet: { pendingBalance: 100, availableBalance: 50 },
    });
  });
});
