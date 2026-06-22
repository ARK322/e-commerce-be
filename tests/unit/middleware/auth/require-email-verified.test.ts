import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';

const mockUserFindById = vi.fn();

vi.mock('@/infrastructure/mongo', () => ({
  User: {
    findById: (...args: unknown[]) => mockUserFindById(...args),
  },
}));

import { requireEmailVerified } from '@/middleware/auth/require-email-verified';

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

describe('requireEmailVerified', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auth yoksa 401 döner', async () => {
    const request = { auth: undefined } as FastifyRequest;
    const reply = createReply();

    await requireEmailVerified(request, reply);

    expect(reply.statusCode).toBe(401);
    expect(reply.body).toEqual({ message: 'Giriş gerekli' });
  });

  it('doğrulanmamış buyer için 403 döner', async () => {
    mockUserFindById.mockReturnValue({
      select: vi.fn().mockResolvedValue({ isEmailVerified: false, role: 'buyer' }),
    });

    const request = { auth: { userId, role: 'buyer' } } as FastifyRequest;
    const reply = createReply();

    await requireEmailVerified(request, reply);

    expect(reply.statusCode).toBe(403);
    expect(reply.body).toEqual({ message: 'E-posta adresini doğrulamadan devam edemezsin' });
  });

  it('admin için e-posta doğrulaması atlanır', async () => {
    mockUserFindById.mockReturnValue({
      select: vi.fn().mockResolvedValue({ isEmailVerified: false, role: 'admin' }),
    });

    const request = { auth: { userId, role: 'admin' } } as FastifyRequest;
    const reply = createReply();

    await requireEmailVerified(request, reply);

    expect(reply.statusCode).toBe(200);
    expect(reply.body).toBeUndefined();
  });

  it('doğrulanmış buyer geçer', async () => {
    mockUserFindById.mockReturnValue({
      select: vi.fn().mockResolvedValue({ isEmailVerified: true, role: 'buyer' }),
    });

    const request = { auth: { userId, role: 'buyer' } } as FastifyRequest;
    const reply = createReply();

    await requireEmailVerified(request, reply);

    expect(reply.statusCode).toBe(200);
    expect(reply.body).toBeUndefined();
  });
});
