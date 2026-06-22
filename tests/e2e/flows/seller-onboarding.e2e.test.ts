import '../helpers/mocks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { Seller } from '@/infrastructure/mongo';
import { createE2EContext, destroyE2EContext } from '../helpers/setup';
import { isE2EEnabled } from '../helpers/env';
import {
  buildCompleteSellerProfilePayload,
  loginUser,
  registerSeller,
  seedOwnerAdmin,
  verifyUserEmail,
} from '../helpers/fixtures';

const describeE2E = isE2EEnabled() ? describe : describe.skip;

describeE2E('seller onboarding (E2E)', () => {
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

  it('register → profil → admin onay → ürün listesi', async () => {
    const { email, password, userId } = await registerSeller(app);
    await verifyUserEmail(app, userId);

    const sellerToken = await loginUser(app, email, password);

    const profileResponse = await app.inject({
      method: 'PATCH',
      url: '/auth/profile',
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: buildCompleteSellerProfilePayload(),
    });

    expect(profileResponse.statusCode).toBe(200);

    const approveResponse = await app.inject({
      method: 'POST',
      url: `/auth/admin/sellers/${userId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(approveResponse.statusCode).toBe(200);

    const seller = await Seller.findById(userId).lean();
    expect(seller?.approvalStatus).toBe('approved');
    expect(seller?.iyzicoSubMerchantKey).toBeTruthy();

    const productsResponse = await app.inject({
      method: 'GET',
      url: '/auth/seller/products/mine',
      headers: { authorization: `Bearer ${sellerToken}` },
    });

    expect(productsResponse.statusCode).toBe(200);
    expect(productsResponse.json()).toMatchObject({ products: [] });
  });
});
