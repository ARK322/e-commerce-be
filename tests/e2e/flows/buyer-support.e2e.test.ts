import '../helpers/mocks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createE2EContext, destroyE2EContext } from '../helpers/setup';
import { isE2EEnabled } from '../helpers/env';
import {
  completeBuyerProfile,
  loginUser,
  registerBuyer,
  verifyUserEmail,
} from '../helpers/fixtures';

const describeE2E = isE2EEnabled() ? describe : describe.skip;

describeE2E('buyer support ticket (E2E)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await createE2EContext());
  });

  afterAll(async () => {
    await destroyE2EContext(app);
  });

  it('alıcı destek talebi oluşturur ve listeler', async () => {
    const { email, password, userId } = await registerBuyer(app);
    await verifyUserEmail(app, userId);

    const token = await loginUser(app, email, password);
    await completeBuyerProfile(app, token);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/support',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        subject: 'Sipariş hakkında soru',
        category: 'order',
        body: 'Siparişim ne zaman kargoya verilecek?',
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const createBody = createResponse.json() as { ticket: { id: string; status: string } };
    expect(createBody.ticket.status).toBe('open');

    const listResponse = await app.inject({
      method: 'GET',
      url: '/support?page=1&limit=20',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(listResponse.statusCode).toBe(200);
    const listBody = listResponse.json() as { items: Array<{ id: string }> };
    expect(listBody.items.some((entry) => entry.id === createBody.ticket.id)).toBe(true);

    const messageResponse = await app.inject({
      method: 'POST',
      url: `/support/${createBody.ticket.id}/messages`,
      headers: { authorization: `Bearer ${token}` },
      payload: { body: 'Ek bilgi: acil değil' },
    });

    expect(messageResponse.statusCode).toBe(201);
  });
});
