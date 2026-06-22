import { describe, expect, it } from 'vitest';
import fastify from 'fastify';
import { PRODUCT_MULTIPART_LIMITS } from '@/config/constants';
import { registerProductMultipart } from '@/shared/plugins/multipart/product';

describe('registerProductMultipart', () => {
  it('multipart eklentisini ürün limitleriyle register eder', async () => {
    const app = fastify({ logger: false });
    await registerProductMultipart(app);

    app.post('/upload', async (req, reply) => {
      const hasMultipart = typeof req.file === 'function';
      return reply.send({ hasMultipart, limits: PRODUCT_MULTIPART_LIMITS });
    });

    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/upload',
      headers: { 'content-type': 'application/json' },
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      hasMultipart: true,
      limits: {
        fileSize: 2 * 1024 * 1024,
        files: 10,
      },
    });

    await app.close();
  });
});
