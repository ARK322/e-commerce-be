import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { registerRequestId } from '@/plugins/request-id/register';

describe('registerRequestId', () => {
  it('gelen x-request-id headerını yanıta yansıtır', async () => {
    const app = Fastify();
    registerRequestId(app);
    app.get('/ping', async () => ({ ok: true }));

    const response = await app.inject({
      method: 'GET',
      url: '/ping',
      headers: { 'x-request-id': 'custom-request-id-123' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe('custom-request-id-123');
    await app.close();
  });

  it('header yoksa otomatik request id üretir', async () => {
    const app = Fastify();
    registerRequestId(app);
    app.get('/ping', async () => ({ ok: true }));

    const response = await app.inject({ method: 'GET', url: '/ping' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBeTruthy();
    await app.close();
  });
});
