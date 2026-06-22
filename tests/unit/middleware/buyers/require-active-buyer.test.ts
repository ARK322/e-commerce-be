import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';

const mockUserFindById = vi.fn();

vi.mock('@/infrastructure/mongo', () => ({
  User: {
    findById: (...args: unknown[]) => mockUserFindById(...args),
  },
}));

import { requireActiveBuyer } from '@/middleware/buyers/require-active-buyer';

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

describe('requireActiveBuyer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auth yoksa 401 döner', async () => {
    const request = {} as FastifyRequest;
    const reply = createReply();

    await requireActiveBuyer(request, reply);

    expect(reply.statusCode).toBe(401);
    expect(reply.body).toEqual({ message: 'Giriş gerekli' });
  });

  it('buyer değilse 403 döner', async () => {
    const request = {
      auth: { userId, role: 'seller' },
    } as FastifyRequest;
    const reply = createReply();

    await requireActiveBuyer(request, reply);

    expect(reply.statusCode).toBe(403);
    expect(reply.body).toEqual({ message: 'Bu işlem için alıcı hesabı gerekli' });
  });

  it('profil tamamlanmamışsa 403 döner', async () => {
    mockUserFindById.mockReturnValue({
      select: vi.fn().mockResolvedValue({ isActive: false, role: 'buyer' }),
    });

    const request = {
      auth: { userId, role: 'buyer' },
    } as FastifyRequest;
    const reply = createReply();

    await requireActiveBuyer(request, reply);

    expect(reply.statusCode).toBe(403);
    expect(reply.body).toEqual({
      message: 'Profilini tamamlamadan alışveriş yapamazsın',
    });
  });

  it('aktif buyer için geçer', async () => {
    mockUserFindById.mockReturnValue({
      select: vi.fn().mockResolvedValue({ isActive: true, role: 'buyer' }),
    });

    const request = {
      auth: { userId, role: 'buyer' },
    } as FastifyRequest;
    const reply = createReply();

    await requireActiveBuyer(request, reply);

    expect(reply.statusCode).toBe(200);
    expect(reply.body).toBeUndefined();
  });
});
