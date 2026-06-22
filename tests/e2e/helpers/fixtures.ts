import type { FastifyInstance } from 'fastify';
import { expect } from 'vitest';
import { hashPassword } from '@/shared/security';
import { createUserId } from '@/shared/ids';
import { signEmailVerificationToken } from '@/domains/identity/application/tokens/email-token';
import { ensureSystemOwnerRole } from '@/domains/identity/application/access/admin/system-roles';
import { Admin, Category, Product, Seller, User } from '@/integrations/mongo';

export const registerBuyer = async (app: FastifyInstance, email?: string) => {
  const resolvedEmail = email ?? `buyer-e2e-${Date.now()}@test.local`;
  const password = 'Test1234!';

  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email: resolvedEmail, password, role: 'buyer' },
  });

  expect(response.statusCode).toBe(201);

  const user = await User.findOne({ email: resolvedEmail }).lean();

  if (!user) {
    throw new Error('Buyer user not created');
  }

  return { email: resolvedEmail, password, userId: String(user._id) };
};

export const registerSeller = async (app: FastifyInstance, email?: string) => {
  const resolvedEmail = email ?? `seller-e2e-${Date.now()}@test.local`;
  const password = 'Test1234!';

  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email: resolvedEmail, password, role: 'seller' },
  });

  expect(response.statusCode).toBe(201);

  const user = await User.findOne({ email: resolvedEmail }).lean();

  if (!user) {
    throw new Error('Seller user not created');
  }

  return { email: resolvedEmail, password, userId: String(user._id) };
};

export const verifyUserEmail = async (app: FastifyInstance, userId: string) => {
  const user = await User.findById(userId).lean();

  if (!user?.activeEmailVerifyJti) {
    throw new Error('activeEmailVerifyJti not found on user — register flow may have failed');
  }

  const token = signEmailVerificationToken(userId, user.activeEmailVerifyJti);

  const response = await app.inject({
    method: 'POST',
    url: '/auth/verify-email',
    payload: { token },
  });

  expect(response.statusCode).toBe(200);
};

export const loginUser = async (
  app: FastifyInstance,
  email: string,
  password: string
) => {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password, rememberMe: false },
  });

  expect(response.statusCode).toBe(200);

  const body = response.json() as { token: string };

  return body.token;
};

export const completeBuyerProfile = async (app: FastifyInstance, token: string) => {
  const response = await app.inject({
    method: 'PATCH',
    url: '/auth/profile',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      firstName: 'Ali',
      lastName: 'Yılmaz',
      phone: '+905551112233',
      country: 'Türkiye',
      city: 'İstanbul',
      nationalId: '12345678901',
      deliveryAddress: 'Kadıköy Mah. No:1',
      billingSameAsDelivery: true,
    },
  });

  expect(response.statusCode).toBe(200);
};

export type CatalogFixture = {
  categoryId: string;
  sellerId: string;
  productId: string;
  productPrice: number;
};

export const seedApprovedSellerCatalog = async (): Promise<CatalogFixture> => {
  const sellerId = createUserId();
  const categoryId = createUserId();
  const productId = createUserId();
  const passwordHash = await hashPassword('Test1234!');
  const productPrice = 199.99;

  await User.create({
    _id: sellerId,
    email: `seller-fixture-${sellerId.slice(0, 8)}@test.local`,
    password: passwordHash,
    role: 'seller',
    isActive: true,
    isEmailVerified: true,
  });

  await Seller.create({
    _id: sellerId,
    approvalStatus: 'approved',
    sellerType: 'kurumsal',
    companyName: 'E2E Test A.Ş.',
    iyzicoSubMerchantKey: 'e2e-sub-merchant-key',
  });

  await Category.create({
    _id: categoryId,
    name: 'E2E Kategori',
    slug: `e2e-cat-${Date.now()}`,
    isActive: true,
    isLeaf: true,
    parentIds: [],
    childIds: [],
  });

  await Product.create({
    _id: productId,
    sellerId,
    categoryId,
    name: 'E2E Test Ürün',
    slug: `e2e-product-${Date.now()}`,
    price: productPrice,
    currency: 'TRY',
    stock: 50,
    minOrderQuantity: 1,
    isActive: true,
    images: [],
  });

  return { categoryId, sellerId, productId, productPrice };
};

export const seedOwnerAdmin = async () => {
  const ownerRole = await ensureSystemOwnerRole();
  const adminId = createUserId();
  const password = 'AdminPass1!';
  const passwordHash = await hashPassword(password);
  const email = `admin-e2e-${Date.now()}@test.local`;

  await User.create({
    _id: adminId,
    email,
    password: passwordHash,
    role: 'admin',
    isActive: true,
    isEmailVerified: true,
  });

  await Admin.create({
    _id: adminId,
    roleId: String(ownerRole._id),
    firstName: 'E2E',
    lastName: 'Admin',
  });

  return { adminId, email, password };
};

export const buildCompleteSellerProfilePayload = () => ({
  sellerType: 'kurumsal' as const,
  companyType: 'ltd' as const,
  companyName: 'E2E Satıcı A.Ş.',
  taxNumber: '1234567890',
  taxOffice: 'Kadıköy',
  country: 'Türkiye',
  city: 'İstanbul',
  district: 'Kadıköy',
  companyAddress: 'Bağdat Cad. No:1 İstanbul',
  authorizedFirstName: 'Ayşe',
  authorizedLastName: 'Satıcı',
  authorizedPhone: '+905559998877',
  companyPhone: '+905559998877',
  bankName: 'Test Bank',
  iban: 'TR330006100519786457841326',
  accountHolderName: 'E2E Satıcı A.Ş.',
  companyDescription: 'E2E test satıcı şirketi açıklama metni.',
  companyWebsite: 'https://example.com',
});
