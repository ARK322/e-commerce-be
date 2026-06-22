import { describe, expect, it } from 'vitest';
import fastify from 'fastify';
import { validateParams } from '@/shared/middleware/validation/validate-params';
import { categoryIdParamSchema } from '@/shared/validation/param-schemas';

const categoryId = '550e8400-e29b-41d4-a716-446655440000';

describe('validateParams', () => {
  it('geçerli param kabul edilir', async () => {
    const app = fastify({ logger: false });

    app.get('/:categoryId', { preHandler: validateParams(categoryIdParamSchema) }, async (req, reply) => {
      return reply.send(req.params);
    });

    await app.ready();

    const response = await app.inject({ method: 'GET', url: `/${categoryId}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ categoryId });

    await app.close();
  });

  it('geçersiz param 400 döner', async () => {
    const app = fastify({ logger: false });

    app.get('/:categoryId', { preHandler: validateParams(categoryIdParamSchema) }, async (req, reply) => {
      return reply.send(req.params);
    });

    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/bad-id' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: 'Geçersiz adres parametresi' });

    await app.close();
  });
});
