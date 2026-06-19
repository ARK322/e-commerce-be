import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { hashPassword } from '@/internal/security';
import { signAuthToken } from '@/internal/auth/tokens/access-token';
import { buildApp } from '@/app/app';

const mockUserFindOne = vi.fn();
const mockUserFindById = vi.fn();
const mockSellerFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();
const mockGetSellerContext = vi.fn();

vi.mock('@/internal/auth/queries/seller-context', () => ({
  getSellerContext: (...args: unknown[]) => mockGetSellerContext(...args),
}));

vi.mock('@/integrations/mongo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/integrations/mongo')>();
  return {
    ...actual,
    User: {
      ...actual.User,
      findOne: (...args: unknown[]) => mockUserFindOne(...args),
      findById: (...args: unknown[]) => mockUserFindById(...args),
    },
    Seller: {
      ...actual.Seller,
      findById: (...args: unknown[]) => mockSellerFindById(...args),
    },
    RevokedToken: {
      ...actual.RevokedToken,
      exists: (...args: unknown[]) => mockRevokedTokenExists(...args),
    },
  };
});

const userId = '550e8400-e29b-41d4-a716-446655440000';
const sellerEmail = 'seller@test.com';
const sellerPassword = 'Test1234!';

const mockSellerProfile = (approvalStatus: 'draft' | 'approved' = 'draft') => {
  mockSellerFindById.mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue({ approvalStatus }),
    }),
  });
};

const mockAuthenticatedUser = () => {
  mockUserFindById.mockReturnValue({
    select: vi.fn().mockResolvedValue({
      _id: userId,
      email: sellerEmail,
      role: 'seller',
      isEmailVerified: true,
      passwordChangedAt: null,
      sessionsRevokedAt: null,
    }),
  });
};

describe('auth routes integration', () => {
  let app: FastifyInstance;
  let sellerPasswordHash = '';

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-secret';
    sellerPasswordHash = await hashPassword(sellerPassword);
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRevokedTokenExists.mockResolvedValue(null);
    mockGetSellerContext.mockResolvedValue(null);
  });

  it('GET /auth/me token olmadan 401 döner', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ message: 'Giriş gerekli' });
  });

  it('GET /auth/me geçersiz token ile 401 döner', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: 'Bearer invalid.token.here' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('POST /auth/login geçersiz body ile 400 döner', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: 'Geçersiz istek verisi' });
  });

  it('POST /auth/login bilinmeyen e-posta ile 401 döner', async () => {
    mockUserFindOne.mockResolvedValue(null);

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: sellerEmail, password: sellerPassword },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ message: 'E-posta veya şifre hatalı' });
  });

  it('POST /auth/login doğrulanmamış seller ile 403 döner', async () => {
    mockUserFindOne.mockResolvedValue({
      _id: userId,
      email: sellerEmail,
      password: sellerPasswordHash,
      role: 'seller',
      isEmailVerified: false,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: sellerEmail, password: sellerPassword },
    });

    expect(response.statusCode).toBe(403);
  });

  it('POST /auth/login başarılı seller token döner', async () => {
    mockUserFindOne.mockResolvedValue({
      _id: userId,
      email: sellerEmail,
      password: sellerPasswordHash,
      role: 'seller',
      isEmailVerified: true,
    });
    mockSellerProfile('draft');

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: sellerEmail, password: sellerPassword },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.token).toBeTypeOf('string');
    expect(body.role).toBe('seller');
    expect(body.message).toBe('Giriş başarılı');
  });

  it('GET /auth/me geçerli token ile profil özeti döner', async () => {
    const token = signAuthToken(userId, 'seller');
    mockAuthenticatedUser();
    mockSellerProfile('draft');

    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      email: sellerEmail,
      role: 'seller',
      approvalStatus: 'draft',
      companyId: userId,
      isOwner: true,
    });
  });

  it('PATCH /auth/profile token olmadan 401 döner', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/auth/profile',
      payload: { companyName: 'Test' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('POST /auth/register geçersiz body ile 400 döner', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'not-an-email' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('POST /auth/register admin rolü ile 400 döner', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'hack@test.com',
        password: 'Test1234!',
        role: 'admin',
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
