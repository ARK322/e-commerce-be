import { describe, expect, it } from 'vitest';
import type { FastifyReply } from 'fastify';
import { AuthError } from '@/internal/auth/errors';
import { EcommerceError } from '@/internal/ecommerce/errors';
import { handleRouteError } from '@/internal/errors/handle-route-error';

const createReply = () => {
  const reply = {
    statusCode: 0,
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

describe('handleRouteError', () => {
  it('HttpError için status ve mesaj döner', () => {
    const reply = createReply();

    handleRouteError(reply, new EcommerceError(404, 'Ürün bulunamadı'), 'Sunucu hatası');

    expect(reply.statusCode).toBe(404);
    expect(reply.body).toEqual({ message: 'Ürün bulunamadı' });
  });

  it('AuthError için status ve mesaj döner', () => {
    const reply = createReply();

    handleRouteError(reply, new AuthError(403, 'Yetkisiz'), 'Sunucu hatası');

    expect(reply.statusCode).toBe(403);
    expect(reply.body).toEqual({ message: 'Yetkisiz' });
  });

  it('duplicate key için 409 döner', () => {
    const reply = createReply();

    handleRouteError(reply, { code: 11000 }, 'Kayıt hatası', {
      duplicateKeyMessage: 'Kayıt zaten var',
    });

    expect(reply.statusCode).toBe(409);
    expect(reply.body).toEqual({ message: 'Kayıt zaten var' });
  });

  it('bilinmeyen hata için fallback mesaj döner', () => {
    const reply = createReply();

    handleRouteError(reply, new Error('boom'), 'İşlem sırasında bir hata oluştu');

    expect(reply.statusCode).toBe(500);
    expect(reply.body).toEqual({ message: 'İşlem sırasında bir hata oluştu' });
  });
});
