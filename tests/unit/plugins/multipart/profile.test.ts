import { describe, expect, it } from 'vitest';
import fastify from 'fastify';
import { PROFILE_DOCUMENT_MULTIPART_LIMITS } from '@/config/constants';
import { registerProfileDocumentMultipart } from '@/shared/plugins/multipart/profile';

describe('registerProfileDocumentMultipart', () => {
  it('multipart eklentisini profil belge limitleriyle register eder', async () => {
    const app = fastify({ logger: false });
    await registerProfileDocumentMultipart(app);

    app.post('/upload', async (req, reply) => {
      const hasMultipart = typeof req.file === 'function';
      return reply.send({ hasMultipart, limits: PROFILE_DOCUMENT_MULTIPART_LIMITS });
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
        fileSize: 5 * 1024 * 1024,
        files: 1,
      },
    });

    await app.close();
  });
});
