import { describe, expect, it } from 'vitest';
import fastify from 'fastify';
import { registerGlobalRateLimit } from '@/shared/plugins/rate-limit/register-global';

describe('registerGlobalRateLimit', () => {
  it('global rate limit plugin register edilir', async () => {
    const app = fastify({ logger: false });
    await registerGlobalRateLimit(app);

    app.get('/ping', async (_req, reply) => reply.send({ ok: true }));

    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/ping' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });

    await app.close();
  });
});
