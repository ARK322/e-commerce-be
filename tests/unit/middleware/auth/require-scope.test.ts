import { describe, expect, it } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  authorize,
  requireAllScopes,
  requireScope,
} from '@/shared/middleware/auth/require-scope';

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

const requestWith = (role: 'buyer' | 'seller' | 'admin', scopes: string[]) =>
  ({ auth: { userId, role, scopes } }) as FastifyRequest;

describe('requireScope', () => {
  it('auth yoksa 401 döner', async () => {
    const reply = createReply();
    await requireScope('products:write')({ auth: undefined } as FastifyRequest, reply);
    expect(reply.statusCode).toBe(401);
  });

  it('scope mevcutsa geçer', async () => {
    const reply = createReply();
    await requireScope('products:write')(requestWith('seller', ['products:write']), reply);
    expect(reply.statusCode).toBe(200);
  });

  it('scope yoksa 403 döner', async () => {
    const reply = createReply();
    await requireScope('products:write')(requestWith('buyer', ['cart:write']), reply);
    expect(reply.statusCode).toBe(403);
  });

  it('admin wildcard scope ile her kapsamı geçer', async () => {
    const reply = createReply();
    await requireScope('products:write')(requestWith('admin', ['*']), reply);
    expect(reply.statusCode).toBe(200);
  });

  it('any-of: istenenlerden biri yeterli', async () => {
    const reply = createReply();
    await requireScope('products:write', 'fulfillment:manage')(
      requestWith('seller', ['fulfillment:manage']),
      reply
    );
    expect(reply.statusCode).toBe(200);
  });
});

describe('requireAllScopes', () => {
  it('tümü varsa geçer', async () => {
    const reply = createReply();
    await requireAllScopes('products:read', 'products:write')(
      requestWith('seller', ['products:read', 'products:write']),
      reply
    );
    expect(reply.statusCode).toBe(200);
  });

  it('biri eksikse 403 döner', async () => {
    const reply = createReply();
    await requireAllScopes('products:read', 'products:write')(
      requestWith('buyer', ['products:read']),
      reply
    );
    expect(reply.statusCode).toBe(403);
  });
});

describe('authorize (hibrit rol + scope)', () => {
  it('rol uyuşmazsa 403 döner', async () => {
    const reply = createReply();
    await authorize({ roles: ['seller'] })(requestWith('buyer', ['cart:write']), reply);
    expect(reply.statusCode).toBe(403);
  });

  it('rol ve scope birlikte sağlanırsa geçer', async () => {
    const reply = createReply();
    await authorize({ roles: ['seller'], scopes: ['products:write'] })(
      requestWith('seller', ['products:write']),
      reply
    );
    expect(reply.statusCode).toBe(200);
  });

  it('rol doğru ama scope eksikse 403 döner', async () => {
    const reply = createReply();
    await authorize({ roles: ['seller'], scopes: ['products:write'] })(
      requestWith('seller', ['products:read']),
      reply
    );
    expect(reply.statusCode).toBe(403);
  });
});
