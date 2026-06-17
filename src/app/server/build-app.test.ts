import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '@/app/server/build-app';

describe('buildApp', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('OPTIONS preflight PATCH methoduna izin verir', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/auth/profile',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'PATCH',
        'access-control-request-headers': 'authorization,content-type',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-methods']).toContain('PATCH');
  });

  it('tanımsız route 404 döner', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/not-registered',
    });

    expect(response.statusCode).toBe(404);
  });
});
