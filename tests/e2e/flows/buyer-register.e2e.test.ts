import '../helpers/mocks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { User } from '@/infrastructure/mongo';
import { createE2EContext, destroyE2EContext } from '../helpers/setup';
import { isE2EEnabled } from '../helpers/env';

const describeE2E = isE2EEnabled() ? describe : describe.skip;

describeE2E('buyer register (E2E)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await createE2EContext());
  });

  afterAll(async () => {
    await destroyE2EContext(app);
  });

  it('POST /auth/register buyer kaydı oluşturur', async () => {
    const email = `buyer-e2e-${Date.now()}@test.local`;

    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email,
        password: 'Test1234!',
        role: 'buyer',
      },
    });

    expect(response.statusCode).toBe(201);

    const user = await User.findOne({ email }).lean();

    expect(user).toMatchObject({
      role: 'buyer',
      isEmailVerified: false,
      isActive: false,
    });
  });
});
