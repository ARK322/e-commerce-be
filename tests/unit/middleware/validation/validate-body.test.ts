import { describe, expect, it } from 'vitest';
import fastify from 'fastify';
import { z } from 'zod';
import { validateBody } from '@/shared/middleware/validation/validate-body';

const testSchema = z.object({
  name: z.string().min(1),
});

describe('validateBody', () => {
  it('geçerli body parse edilir', async () => {
    const app = fastify({ logger: false });

    app.post('/', { preHandler: validateBody(testSchema) }, async (req, reply) => {
      return reply.send(req.body);
    });

    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/',
      payload: { name: 'Test' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ name: 'Test' });

    await app.close();
  });

  it('geçersiz body 400 döner', async () => {
    const app = fastify({ logger: false });

    app.post('/', { preHandler: validateBody(testSchema) }, async (req, reply) => {
      return reply.send(req.body);
    });

    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/',
      payload: { name: '' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: 'Geçersiz istek verisi' });

    await app.close();
  });
});
