import '../helpers/mocks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { User } from '@/infrastructure/mongo';
import { createE2EContext, destroyE2EContext } from '../helpers/setup';
import { isE2EEnabled } from '../helpers/env';
import {
  completeBuyerProfile,
  loginUser,
  registerBuyer,
  verifyUserEmail,
} from '../helpers/fixtures';

const describeE2E = isE2EEnabled() ? describe : describe.skip;

describeE2E('buyer auth (E2E)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await createE2EContext());
  });

  afterAll(async () => {
    await destroyE2EContext(app);
  });

  it('register → verify → login → me akışını tamamlar', async () => {
    const { email, password, userId } = await registerBuyer(app);

    await verifyUserEmail(app, userId);

    const verifiedUser = await User.findById(userId).lean();
    expect(verifiedUser?.isEmailVerified).toBe(true);

    const token = await loginUser(app, email, password);

    const meResponse = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toMatchObject({
      email,
      role: 'buyer',
    });

    await completeBuyerProfile(app, token);

    const activeUser = await User.findById(userId).lean();
    expect(activeUser?.isActive).toBe(true);
  });
});
