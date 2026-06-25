import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { signAuthToken } from '@/domain/auth/tokens/access-token';
import { buildApp } from '@/app/app';

const mockListBuyerTickets = vi.fn();
const mockCreateBuyerTicket = vi.fn();
const mockGetBuyerTicket = vi.fn();
const mockListBuyerMessages = vi.fn();
const mockPostBuyerMessage = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/features/support/ticket.service', () => ({
  listBuyerSupportTickets: (...args: unknown[]) => mockListBuyerTickets(...args),
  createBuyerSupportTicket: (...args: unknown[]) => mockCreateBuyerTicket(...args),
  getBuyerSupportTicket: (...args: unknown[]) => mockGetBuyerTicket(...args),
  postBuyerSupportMessage: (...args: unknown[]) => mockPostBuyerMessage(...args),
  listBuyerSupportMessages: (...args: unknown[]) => mockListBuyerMessages(...args),
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

const buyerId = '550e8400-e29b-41d4-a716-446655440000';
const ticketId = '8c9e6679-7425-40de-944b-e07fc1f90ae8';

const mockActiveBuyer = () => {
  mockUserFindById.mockImplementation((id: string) => {
    if (id === buyerId) {
      return {
        select: vi.fn().mockResolvedValue({
          _id: buyerId,
          role: 'buyer',
          isActive: true,
          isEmailVerified: true,
          passwordChangedAt: null,
          sessionsRevokedAt: null,
        }),
      };
    }

    return {
      select: vi.fn().mockResolvedValue({ isActive: true, isEmailVerified: true, role: 'buyer' }),
    };
  });
};

describe('buyer support routes integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? 'integration-test-jwt-secret-with-32-chars-minimum';
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRevokedTokenExists.mockResolvedValue(null);
  });

  it('GET /support token olmadan 401 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/support' });

    expect(response.statusCode).toBe(401);
  });

  it('GET /support buyer ile ticket listesi döner', async () => {
    const token = signAuthToken(buyerId, 'buyer');
    mockActiveBuyer();
    mockListBuyerTickets.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });

    const response = await app.inject({
      method: 'GET',
      url: '/support?page=1&limit=20',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(mockListBuyerTickets).toHaveBeenCalled();
  });

  it('POST /support buyer ticket oluşturur', async () => {
    const token = signAuthToken(buyerId, 'buyer');
    mockActiveBuyer();
    mockCreateBuyerTicket.mockResolvedValue({
      ticket: { id: '8c9e6679-7425-40de-944b-e07fc1f90ae8', status: 'open' },
      initialMessage: { id: 'msg-1' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/support',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        subject: 'Sipariş sorusu',
        category: 'order',
        body: 'Ne zaman kargoya verilir?',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ message: 'Destek talebi oluşturuldu' });
    expect(mockCreateBuyerTicket).toHaveBeenCalled();
  });

  it('GET /support/:ticketId buyer ticket detayı döner', async () => {
    const token = signAuthToken(buyerId, 'buyer');
    mockActiveBuyer();
    mockGetBuyerTicket.mockResolvedValue({ ticket: { id: ticketId, status: 'open' } });

    const response = await app.inject({
      method: 'GET',
      url: `/support/${ticketId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetBuyerTicket).toHaveBeenCalledWith(buyerId, ticketId);
  });

  it('GET /support/:ticketId/messages mesaj listesi döner', async () => {
    const token = signAuthToken(buyerId, 'buyer');
    mockActiveBuyer();
    mockListBuyerMessages.mockResolvedValue({ items: [{ id: 'msg-1' }], total: 1, page: 1, limit: 20 });

    const response = await app.inject({
      method: 'GET',
      url: `/support/${ticketId}/messages?page=1&limit=20`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ total: 1 });
  });

  it('POST /support/:ticketId/messages mesaj gönderir', async () => {
    const token = signAuthToken(buyerId, 'buyer');
    mockActiveBuyer();
    mockPostBuyerMessage.mockResolvedValue({ supportMessage: { id: 'msg-2', body: 'Ek bilgi' } });

    const response = await app.inject({
      method: 'POST',
      url: `/support/${ticketId}/messages`,
      headers: { authorization: `Bearer ${token}` },
      payload: { body: 'Ek bilgi' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ message: 'Mesaj gönderildi' });
  });
});
