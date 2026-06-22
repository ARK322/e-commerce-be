import { describe, expect, it } from 'vitest';
import fastify from 'fastify';
import { validateQuery } from '@/shared/middleware/validation/validate-query';
import { listProductsQuerySchema } from '@/api/public/catalog/products/list-products.schema';

describe('validateQuery', () => {
  it('geçerli query parse edilir', async () => {
    const app = fastify({ logger: false });

    app.get('/', { preHandler: validateQuery(listProductsQuerySchema) }, async (req, reply) => {
      return reply.send(req.query);
    });

    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/?page=2&limit=10' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ page: 2, limit: 10 });

    await app.close();
  });

  it('geçersiz query 400 döner', async () => {
    const app = fastify({ logger: false });

    app.get('/', { preHandler: validateQuery(listProductsQuerySchema) }, async (req, reply) => {
      return reply.send(req.query);
    });

    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/?page=0' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: 'Geçersiz sorgu parametresi' });

    await app.close();
  });
});
