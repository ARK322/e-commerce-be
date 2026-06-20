import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';

const mockUserFindById = vi.fn();
const mockIsTokenRevoked = vi.fn();
const mockVerifyAuthToken = vi.fn();

vi.mock('@/integrations/mongo', () => ({
  User: {
    findById: (...args: unknown[]) => mockUserFindById(...args),
  },
}));

vi.mock('@/internal/auth/tokens/revoke-token', () => ({
  isTokenRevoked: (...args: unknown[]) => mockIsTokenRevoked(...args),
}));

vi.mock('@/internal/auth/tokens/access-token', () => ({
  verifyAuthToken: (...args: unknown[]) => mockVerifyAuthToken(...args),
}));

import { requireAuth } from '@/middleware/auth/require-auth';

const userId = '550e8400-e29b-41d4-a716-446655440000';

const createReply = () => {
  const reply = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
  };

  return reply as unknown as FastifyReply & { statusCode: number; body: unknown };
};

const createRequest = (token = 'valid-token') =>
  ({
    headers: { authorization: `Bearer ${token}` },
  }) as FastifyRequest;

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters-long';
    mockIsTokenRevoked.mockResolvedValue(false);
    mockVerifyAuthToken.mockReturnValue({ userId, role: 'seller' });
  });

  it('token yoksa 401 döner', async () => {
    const request = { headers: {} } as FastifyRequest;
    const reply = createReply();

    await requireAuth(request, reply);

    expect(reply.statusCode).toBe(401);
    expect(reply.body).toEqual({ message: 'Giriş gerekli' });
  });

  it('DB rolü token ile uyuşmazsa 401 döner', async () => {
    mockUserFindById.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        role: 'buyer',
        isActive: true,
        passwordChangedAt: null,
        sessionsRevokedAt: null,
      }),
    });

    const request = createRequest();
    const reply = createReply();

    await requireAuth(request, reply);

    expect(reply.statusCode).toBe(401);
    expect(reply.body).toEqual({ message: 'Oturum geçersiz, tekrar giriş yapın' });
  });

  it('kullanıcı silinmişse 401 döner', async () => {
    mockUserFindById.mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    });

    const request = createRequest();
    const reply = createReply();

    await requireAuth(request, reply);

    expect(reply.statusCode).toBe(401);
    expect(reply.body).toEqual({ message: 'Oturum geçersiz, tekrar giriş yapın' });
  });

  it('geçerli token ve rol ile auth set eder', async () => {
    mockUserFindById.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        role: 'seller',
        isActive: true,
        passwordChangedAt: null,
        sessionsRevokedAt: null,
      }),
    });

    const request = createRequest();
    const reply = createReply();

    await requireAuth(request, reply);

    expect(request.auth).toEqual({ userId, role: 'seller' });
    expect(reply.body).toBeUndefined();
  });

  it('pasif admin/seller hesabı 403 döner', async () => {
    mockVerifyAuthToken.mockReturnValue({ userId, role: 'admin' });
    mockUserFindById.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        role: 'admin',
        isActive: false,
        passwordChangedAt: null,
        sessionsRevokedAt: null,
      }),
    });

    const request = createRequest();
    const reply = createReply();

    await requireAuth(request, reply);

    expect(reply.statusCode).toBe(403);
    expect(reply.body).toEqual({ message: 'Hesap aktif değil' });
  });
});
