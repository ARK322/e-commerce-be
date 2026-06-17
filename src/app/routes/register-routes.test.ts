import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fastify, { type FastifyInstance } from 'fastify';
import { registerRoutes } from '@/app/routes/register-routes';

describe('registerRoutes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = fastify();
    await registerRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('auth route’ları /auth prefix altında mount edilir', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
    });

    expect(response.statusCode).toBe(401);
  });

  it('ecommerce route’ları root prefix altında mount edilir', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/orders',
      payload: {},
    });

    expect(response.statusCode).toBe(401);
  });

  it('tanımsız route 404 döner', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/not-registered',
    });

    expect(response.statusCode).toBe(404);
  });
});
