import '../helpers/mocks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createE2EContext, destroyE2EContext } from '../helpers/setup';
import { isE2EEnabled } from '../helpers/env';
import {
  completeBuyerProfile,
  loginUser,
  registerBuyer,
  seedOwnerAdmin,
  verifyUserEmail,
} from '../helpers/fixtures';

const describeE2E = isE2EEnabled() ? describe : describe.skip;

describeE2E('admin support (E2E)', () => {
  let app: FastifyInstance;
  let adminToken = '';

  beforeAll(async () => {
    ({ app } = await createE2EContext());
    const admin = await seedOwnerAdmin();
    adminToken = await loginUser(app, admin.email, admin.password);
  });

  afterAll(async () => {
    await destroyE2EContext(app);
  });

  it('alıcı ticket açar, admin listeler ve yanıtlar', async () => {
    const { email, password, userId } = await registerBuyer(app);
    await verifyUserEmail(app, userId);

    const buyerToken = await loginUser(app, email, password);
    await completeBuyerProfile(app, buyerToken);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/support',
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: {
        subject: 'Admin yanıt testi',
        category: 'other',
        body: 'Yardım istiyorum',
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const ticketId = (createResponse.json() as { ticket: { id: string } }).ticket.id;

    const listResponse = await app.inject({
      method: 'GET',
      url: '/auth/admin/support?page=1&limit=20',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(listResponse.statusCode).toBe(200);
    const listBody = listResponse.json() as { items: Array<{ id: string }> };
    expect(listBody.items.some((entry) => entry.id === ticketId)).toBe(true);

    const detailResponse = await app.inject({
      method: 'GET',
      url: `/auth/admin/support/${ticketId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(detailResponse.statusCode).toBe(200);

    const replyResponse = await app.inject({
      method: 'POST',
      url: `/auth/admin/support/${ticketId}/messages`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { body: 'Merhaba, size yardımcı olacağız', isInternal: false },
    });

    expect(replyResponse.statusCode).toBe(201);
    expect(replyResponse.json()).toMatchObject({ message: 'Mesaj gönderildi' });
  });
});
