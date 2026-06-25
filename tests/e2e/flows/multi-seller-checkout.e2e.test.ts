import '../helpers/mocks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { Category, Product, Seller, User } from '@/infrastructure/mongo';
import { hashPassword } from '@/domain/common/security/password';
import { createUserId } from '@/shared/ids';
import { createE2EContext, destroyE2EContext } from '../helpers/setup';
import { isE2EEnabled } from '../helpers/env';
import { mockCompleteIyzicoCheckout } from '../helpers/mocks';
import {
  completeBuyerProfile,
  loginUser,
  registerBuyer,
  seedApprovedSellerCatalog,
  verifyUserEmail,
} from '../helpers/fixtures';

const describeE2E = isE2EEnabled() ? describe : describe.skip;

const seedSecondSellerProduct = async (categoryId: string) => {
  const sellerId = createUserId();
  const productId = createUserId();
  const passwordHash = await hashPassword('Test1234!');
  const productPrice = 149.5;

  await User.create({
    _id: sellerId,
    email: `seller2-fixture-${sellerId.slice(0, 8)}@test.local`,
    password: passwordHash,
    role: 'seller',
    isActive: true,
    isEmailVerified: true,
  });

  await Seller.create({
    _id: sellerId,
    approvalStatus: 'approved',
    sellerType: 'kurumsal',
    companyName: 'E2E İkinci Satıcı A.Ş.',
    iyzicoSubMerchantKey: 'e2e-sub-merchant-key-2',
  });

  await Product.create({
    _id: productId,
    sellerId,
    categoryId,
    name: 'E2E İkinci Ürün',
    slug: `e2e-product-2-${Date.now()}`,
    price: productPrice,
    currency: 'TRY',
    stock: 30,
    minOrderQuantity: 1,
    isActive: true,
    images: [],
  });

  return { sellerId, productId, productPrice };
};

describeE2E('multi-seller checkout (E2E)', () => {
  let app: FastifyInstance;
  let productId1 = '';
  let productId2 = '';
  let price1 = 0;
  let price2 = 0;

  beforeAll(async () => {
    ({ app } = await createE2EContext());
    const catalog = await seedApprovedSellerCatalog();
    productId1 = catalog.productId;
    price1 = catalog.productPrice;

    const category = await Category.findById(catalog.categoryId).lean();
    if (!category) {
      throw new Error('Kategori bulunamadı');
    }

    const second = await seedSecondSellerProduct(String(category._id));
    productId2 = second.productId;
    price2 = second.productPrice;
  });

  afterAll(async () => {
    await destroyE2EContext(app);
  });

  it('iki farklı satıcıdan ürünler tek siparişte ödenir', async () => {
    const { email, password, userId } = await registerBuyer(app);
    await verifyUserEmail(app, userId);

    const buyerToken = await loginUser(app, email, password);
    await completeBuyerProfile(app, buyerToken);

    for (const [productId, quantity] of [
      [productId1, 1],
      [productId2, 1],
    ] as const) {
      const cartResponse = await app.inject({
        method: 'POST',
        url: '/cart/items',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { productId, quantity },
      });
      expect(cartResponse.statusCode).toBe(200);
    }

    const orderResponse = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: {},
    });

    expect(orderResponse.statusCode).toBe(201);
    const orderBody = orderResponse.json() as {
      order: { id: string; totalAmount: number; items: Array<{ sellerId: string }> };
    };
    const orderId = orderBody.order.id;
    const sellerIds = new Set(orderBody.order.items.map((item) => item.sellerId));

    expect(orderBody.order.items).toHaveLength(2);
    expect(sellerIds.size).toBe(2);
    expect(orderBody.order.totalAmount).toBeCloseTo(price1 + price2, 1);

    mockCompleteIyzicoCheckout.mockResolvedValue({
      status: 'completed',
      externalId: 'e2e-multi-seller-payment',
      orderId,
      paidAmount: orderBody.order.totalAmount,
      itemTransactions: [
        { itemId: productId1, paymentTransactionId: 'txn-multi-1' },
        { itemId: productId2, paymentTransactionId: 'txn-multi-2' },
      ],
    });

    const paymentResponse = await app.inject({
      method: 'POST',
      url: '/payments',
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: { orderId },
    });

    expect(paymentResponse.statusCode).toBe(201);

    const callbackResponse = await app.inject({
      method: 'POST',
      url: '/payments/callback',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'token=e2e-multi-seller-token',
    });

    expect(callbackResponse.statusCode).toBe(302);
    expect(callbackResponse.headers.location).toContain('payment=success');
  });
});
