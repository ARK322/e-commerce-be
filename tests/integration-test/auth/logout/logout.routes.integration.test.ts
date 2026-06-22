import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { signAuthToken } from '@/domain/auth/tokens/access-token';
import { buildApp } from '@/app/app';

const mockLogout = vi.fn();
const mockLogoutAllSessions = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/features/auth/logout/logout.service', () => ({
  logout: (...args: unknown[]) => mockLogout(...args),
  logoutAllSessions: (...args: unknown[]) => mockLogoutAllSessions(...args),
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

const userId = '550e8400-e29b-41d4-a716-446655440000';

describe('logout routes integration', () => {
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
    mockLogout.mockResolvedValue(undefined);
    mockLogoutAllSessions.mockResolvedValue(undefined);
    mockUserFindById.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        _id: userId,
        role: 'buyer',
        passwordChangedAt: null,
        sessionsRevokedAt: null,
      }),
    });
  });

  it('POST /auth/logout token olmadan 401 döner', async () => {
    const response = await app.inject({ method: 'POST', url: '/auth/logout' });

    expect(response.statusCode).toBe(401);
  });

  it('POST /auth/logout geçerli token ile çıkış yapar', async () => {
    const token = signAuthToken(userId, 'buyer');

    const response = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: 'Çıkış başarılı' });
    expect(mockLogout).toHaveBeenCalledWith(token);
  });

  it('POST /auth/logout/all tüm oturumları sonlandırır', async () => {
    const token = signAuthToken(userId, 'buyer');

    const response = await app.inject({
      method: 'POST',
      url: '/auth/logout/all',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: 'Tüm oturumlar sonlandırıldı' });
    expect(mockLogoutAllSessions).toHaveBeenCalledWith(userId);
  });
});
