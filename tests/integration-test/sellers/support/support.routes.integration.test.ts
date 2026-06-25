import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SELLER_PERMISSIONS } from '@/domain/auth/access/seller/permission-keys';
import type { SellerAccessContext } from '@/domain/auth/queries/seller-context';
import { signAuthToken } from '@/domain/auth/tokens/access-token';
import { buildApp } from '@/app/app';
import { TEST_JWT_SECRET } from '../../../helpers/jwt-secret';

const mockListSellerSupportTickets = vi.fn();
const mockCreateSellerSupportTicket = vi.fn();
const mockGetSellerSupportTicket = vi.fn();
const mockListSellerSupportMessages = vi.fn();
const mockPostSellerSupportMessage = vi.fn();
const mockGetSellerContext = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/features/support/ticket.service', () => ({
  listSellerSupportTickets: (...args: unknown[]) => mockListSellerSupportTickets(...args),
  createSellerSupportTicket: (...args: unknown[]) => mockCreateSellerSupportTicket(...args),
  getSellerSupportTicket: (...args: unknown[]) => mockGetSellerSupportTicket(...args),
  listSellerSupportMessages: (...args: unknown[]) => mockListSellerSupportMessages(...args),
  postSellerSupportMessage: (...args: unknown[]) => mockPostSellerSupportMessage(...args),
}));

vi.mock('@/domain/auth/queries/seller-context', () => ({
  getSellerContext: (...args: unknown[]) => mockGetSellerContext(...args),
}));

vi.mock('@/infrastructure/mongo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infrastructure/mongo')>();
  return {
    ...actual,
    User: {
      ...actual.User,
      findById: (...args: unknown[]) => mockUserFindById(...args),
    },
    RevokedToken: {
      ...actual.RevokedToken,
      exists: (...args: unknown[]) => mockRevokedTokenExists(...args),
    },
  };
});

const sellerId = '550e8400-e29b-41d4-a716-446655440000';
const ticketId = '8c9e6679-7425-40de-944b-e07fc1f90ae8';

const sellerContext: SellerAccessContext = {
  userId: sellerId,
  companyId: sellerId,
  companyName: 'Test A.Ş.',
  sellerType: 'kurumsal',
  approvalStatus: 'approved',
  roleId: '770e8400-e29b-41d4-a716-446655440000',
  roleSlug: 'owner',
  roleName: 'Owner',
  permissions: new Set(Object.values(SELLER_PERMISSIONS)),
  isOwner: true,
  teamManagementEnabled: true,
  member: { firstName: null, lastName: null, phone: null },
};

const mockApprovedSeller = () => {
  mockUserFindById.mockImplementation((id: string) => {
    if (id === sellerId) {
      return {
        select: vi.fn().mockResolvedValue({
          _id: sellerId,
          role: 'seller',
          isEmailVerified: true,
          passwordChangedAt: null,
          sessionsRevokedAt: null,
        }),
      };
    }

    return {
      select: vi.fn().mockResolvedValue({ isEmailVerified: true, role: 'seller' }),
    };
  });
  mockGetSellerContext.mockResolvedValue(sellerContext);
};

describe('seller support routes integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? TEST_JWT_SECRET;
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRevokedTokenExists.mockResolvedValue(null);
  });

  it('GET /auth/seller/support token olmadan 401 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/seller/support' });

    expect(response.statusCode).toBe(401);
  });

  it('GET /auth/seller/support ticket listesi döner', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockApprovedSeller();
    mockListSellerSupportTickets.mockResolvedValue({
      items: [{ id: ticketId }],
      total: 1,
      page: 1,
      limit: 20,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/seller/support?page=1&limit=20',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ total: 1 });
  });

  it('POST /auth/seller/support ticket oluşturur', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockApprovedSeller();
    mockCreateSellerSupportTicket.mockResolvedValue({
      ticket: { id: ticketId, status: 'open' },
      initialMessage: { id: 'msg-1' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/seller/support',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        subject: 'Sipariş sorunu',
        category: 'order',
        body: 'Ürün hasarlı geldi',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(mockCreateSellerSupportTicket).toHaveBeenCalled();
  });

  it('GET /auth/seller/support/:ticketId ticket detayı döner', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockApprovedSeller();
    mockGetSellerSupportTicket.mockResolvedValue({ ticket: { id: ticketId, status: 'open' } });

    const response = await app.inject({
      method: 'GET',
      url: `/auth/seller/support/${ticketId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetSellerSupportTicket).toHaveBeenCalled();
  });

  it('GET /auth/seller/support/:ticketId/messages mesaj listesi döner', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockApprovedSeller();
    mockListSellerSupportMessages.mockResolvedValue({ items: [{ id: 'msg-1' }], total: 1, page: 1, limit: 20 });

    const response = await app.inject({
      method: 'GET',
      url: `/auth/seller/support/${ticketId}/messages?page=1&limit=20`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ total: 1 });
  });

  it('POST /auth/seller/support/:ticketId/messages mesaj gönderir', async () => {
    const token = signAuthToken(sellerId, 'seller');
    mockApprovedSeller();
    mockPostSellerSupportMessage.mockResolvedValue({ supportMessage: { id: 'msg-2' } });

    const response = await app.inject({
      method: 'POST',
      url: `/auth/seller/support/${ticketId}/messages`,
      headers: { authorization: `Bearer ${token}` },
      payload: { body: 'Satıcı yanıtı' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ message: 'Mesaj gönderildi' });
  });
});
