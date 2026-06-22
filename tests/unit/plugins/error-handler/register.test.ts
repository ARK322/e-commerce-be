import { describe, expect, it } from 'vitest';
import fastify from 'fastify';
import { HttpError } from '@/shared/errors';
import { registerErrorHandler } from '@/shared/plugins/error-handler/register';

describe('registerErrorHandler', () => {
  it('HttpError status ve mesajını döner', async () => {
    const app = fastify({ logger: false });
    registerErrorHandler(app);

    app.get('/fail', async () => {
      throw new HttpError(404, 'Kayıt yok');
    });

    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/fail' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ message: 'Kayıt yok' });

    await app.close();
  });

  it('bilinmeyen hatalarda 500 ve genel mesaj döner', async () => {
    const app = fastify({ logger: false });
    registerErrorHandler(app);

    app.get('/boom', async () => {
      throw new Error('unexpected');
    });

    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ message: 'Sunucu hatası' });

    await app.close();
  });
});
