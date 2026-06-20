import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { signAuthToken } from '@/internal/auth/tokens/access-token';
import { buildApp } from '@/app/app';

const mockGetMe = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/features/identity/me/me.service', () => ({
  getMe: (...args: unknown[]) => mockGetMe(...args),
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

const userId = '550e8400-e29b-41d4-a716-446655440000';

describe('me routes integration', () => {
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

  it('GET /auth/me token olmadan 401 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/me' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ message: 'Giriş gerekli' });
  });

  it('GET /auth/me geçerli token ile kullanıcı özeti döner', async () => {
    const token = signAuthToken(userId, 'buyer');
    mockUserFindById.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        _id: userId,
        role: 'buyer',
        passwordChangedAt: null,
        sessionsRevokedAt: null,
      }),
    });
    mockGetMe.mockResolvedValue({
      email: 'buyer@test.com',
      role: 'buyer',
      isActive: true,
      isEmailVerified: true,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      email: 'buyer@test.com',
      role: 'buyer',
      isActive: true,
      isEmailVerified: true,
    });
    expect(mockGetMe).toHaveBeenCalledWith(expect.objectContaining({ userId, role: 'buyer' }));
  });
});
