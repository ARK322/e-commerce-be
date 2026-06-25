import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '@/domain/auth/access/admin/permission-keys';
import { signAuthToken } from '@/domain/auth/tokens/access-token';
import { buildApp } from '@/app/app';
import { TEST_JWT_SECRET } from '../../../helpers/jwt-secret';

const mockListAdminSupportTickets = vi.fn();
const mockGetAdminSupportTicket = vi.fn();
const mockListAdminSupportMessages = vi.fn();
const mockPostAdminSupportMessage = vi.fn();
const mockUpdateAdminSupportTicket = vi.fn();
const mockGetAdminContext = vi.fn();
const mockUserFindById = vi.fn();
const mockRevokedTokenExists = vi.fn();

vi.mock('@/features/support/ticket.service', () => ({
  listAdminSupportTickets: (...args: unknown[]) => mockListAdminSupportTickets(...args),
  getAdminSupportTicket: (...args: unknown[]) => mockGetAdminSupportTicket(...args),
  listAdminSupportMessages: (...args: unknown[]) => mockListAdminSupportMessages(...args),
  postAdminSupportMessage: (...args: unknown[]) => mockPostAdminSupportMessage(...args),
  updateAdminSupportTicket: (...args: unknown[]) => mockUpdateAdminSupportTicket(...args),
}));

vi.mock('@/domain/auth/queries/admin-context', () => ({
  getAdminContext: (...args: unknown[]) => mockGetAdminContext(...args),
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

const adminId = '550e8400-e29b-41d4-a716-446655440000';
const ticketId = '8c9e6679-7425-40de-944b-e07fc1f90ae8';

const mockAdminAuth = (permissions = new Set([PERMISSIONS.SUPPORT_READ, PERMISSIONS.SUPPORT_WRITE])) => {
  mockUserFindById.mockImplementation((id: string) => {
    if (id === adminId) {
      return {
        select: vi.fn().mockResolvedValue({
          _id: adminId,
          role: 'admin',
          passwordChangedAt: null,
          sessionsRevokedAt: null,
        }),
      };
    }

    return { select: vi.fn().mockResolvedValue({ role: 'admin' }) };
  });
  mockGetAdminContext.mockResolvedValue({
    userId: adminId,
    roleId: '770e8400-e29b-41d4-a716-446655440000',
    roleSlug: 'support',
    roleName: 'Support',
    permissions,
    isOwner: false,
  });
};

describe('admin support routes integration', () => {
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

  it('GET /auth/admin/support token olmadan 401 döner', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/admin/support' });

    expect(response.statusCode).toBe(401);
  });

  it('GET /auth/admin/support ticket listesi döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockListAdminSupportTickets.mockResolvedValue({
      items: [{ id: ticketId, status: 'open' }],
      total: 1,
      page: 1,
      limit: 20,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/admin/support?page=1&limit=20',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ total: 1 });
  });

  it('GET /auth/admin/support/:ticketId ticket detayı döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockGetAdminSupportTicket.mockResolvedValue({ id: ticketId, status: 'open' });

    const response = await app.inject({
      method: 'GET',
      url: `/auth/admin/support/${ticketId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetAdminSupportTicket).toHaveBeenCalled();
  });

  it('POST /auth/admin/support/:ticketId/messages mesaj ekler', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockPostAdminSupportMessage.mockResolvedValue({ id: 'msg-1', body: 'Yanıt' });

    const response = await app.inject({
      method: 'POST',
      url: `/auth/admin/support/${ticketId}/messages`,
      headers: { authorization: `Bearer ${token}` },
      payload: { body: 'Yanıt', isInternal: false },
    });

    expect(response.statusCode).toBe(201);
    expect(mockPostAdminSupportMessage).toHaveBeenCalled();
  });

  it('PATCH /auth/admin/support/:ticketId yetkisiz admin 403 döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth(new Set([PERMISSIONS.SUPPORT_READ]));

    const response = await app.inject({
      method: 'PATCH',
      url: `/auth/admin/support/${ticketId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'closed' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('GET /auth/admin/support/:ticketId/messages mesaj listesi döner', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockListAdminSupportMessages.mockResolvedValue({ items: [{ id: 'msg-1' }], total: 1, page: 1, limit: 20 });

    const response = await app.inject({
      method: 'GET',
      url: `/auth/admin/support/${ticketId}/messages?page=1&limit=20`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ total: 1 });
  });

  it('PATCH /auth/admin/support/:ticketId ticket günceller', async () => {
    const token = signAuthToken(adminId, 'admin');
    mockAdminAuth();
    mockUpdateAdminSupportTicket.mockResolvedValue({ ticket: { id: ticketId, status: 'closed' } });

    const response = await app.inject({
      method: 'PATCH',
      url: `/auth/admin/support/${ticketId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'closed' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ message: 'Destek talebi güncellendi' });
  });
});
