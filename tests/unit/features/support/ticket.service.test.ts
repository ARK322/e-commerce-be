import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '@/internal/auth/access/admin/permission-keys';
import type { AdminAccessContext } from '@/internal/auth/queries/admin-context';

const mockFindOrderByIdLean = vi.fn();
const mockCreateSupportTicketWithInitialMessage = vi.fn();
const mockCreateSupportMessage = vi.fn();
const mockFindSupportTicketByIdOrThrow = vi.fn();
const mockListSupportTicketsLean = vi.fn();
const mockListSupportTicketsForSellerLean = vi.fn();
const mockRecordAdminAction = vi.fn();

vi.mock('@/repositories/buyers/order.repository', () => ({
  findOrderByIdLean: (...args: unknown[]) => mockFindOrderByIdLean(...args),
}));

vi.mock('@/repositories/support/support-ticket.repository', () => ({
  createSupportTicketWithInitialMessage: (...args: unknown[]) =>
    mockCreateSupportTicketWithInitialMessage(...args),
  findSupportTicketByIdOrThrow: (...args: unknown[]) => mockFindSupportTicketByIdOrThrow(...args),
  listSupportTicketsLean: (...args: unknown[]) => mockListSupportTicketsLean(...args),
  listSupportTicketsForSellerLean: (...args: unknown[]) =>
    mockListSupportTicketsForSellerLean(...args),
  touchSupportTicketLastMessageAt: vi.fn().mockResolvedValue(undefined),
  updateSupportTicketById: vi.fn(),
}));

vi.mock('@/repositories/support/support-message.repository', () => ({
  createSupportMessage: (...args: unknown[]) => mockCreateSupportMessage(...args),
  listSupportMessagesLean: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));

vi.mock('@/internal/auth/admin/admin-audit', () => ({
  recordAdminAction: (...args: unknown[]) => mockRecordAdminAction(...args),
}));

import {
  createBuyerSupportTicket,
  getSellerSupportTicket,
  listAdminSupportTickets,
  postBuyerSupportMessage,
} from '@/features/support/ticket.service';
import { AuthError } from '@/internal/auth/errors';
import { CommerceError } from '@/internal/common/errors/commerce-error';

const buyerId = '550e8400-e29b-41d4-a716-446655440000';
const ticketId = '660e8400-e29b-41d4-a716-446655440000';
const orderId = '8c9e6679-7425-40de-944b-e07fc1f90ae8';
const sellerA = '770e8400-e29b-41d4-a716-446655440000';
const sellerB = '880e8400-e29b-41d4-a716-446655440001';

const supportReaderCtx: AdminAccessContext = {
  userId: '770e8400-e29b-41d4-a716-446655440000',
  roleId: '880e8400-e29b-41d4-a716-446655440000',
  roleSlug: 'support',
  roleName: 'Support',
  permissions: new Set([PERMISSIONS.SUPPORT_READ]),
  isOwner: false,
};

const noSupportCtx: AdminAccessContext = {
  ...supportReaderCtx,
  permissions: new Set([PERMISSIONS.ORDERS_READ]),
};

describe('createBuyerSupportTicket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSupportTicketWithInitialMessage.mockResolvedValue({
      ticket: {
        toObject: () => ({
          _id: ticketId,
          subject: 'Sipariş sorunu',
          status: 'open',
          category: 'order',
          orderId,
          buyerId,
          sellerId: null,
          createdByUserId: buyerId,
          createdByRole: 'buyer',
          assignedAdminId: null,
        }),
      },
      message: {
        toObject: () => ({
          _id: 'msg-1',
          ticketId,
          authorUserId: buyerId,
          authorRole: 'buyer',
          body: 'Yardım',
          isInternal: false,
        }),
      },
    });
  });

  it('sipariş bağlantılı talep oluşturur', async () => {
    mockFindOrderByIdLean.mockResolvedValue({
      _id: orderId,
      buyerId,
      items: [{ sellerId: 'seller-1' }],
    });

    const result = await createBuyerSupportTicket(buyerId, {
      subject: 'Sipariş sorunu',
      category: 'order',
      orderId,
      body: 'Yardım',
    });

    expect(result.ticket.id).toBe(ticketId);
    expect(mockCreateSupportTicketWithInitialMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        buyerId,
        orderId,
        sellerId: 'seller-1',
      }),
      expect.objectContaining({ body: 'Yardım' })
    );
  });

  it('çok satıcılı siparişte sellerId null kaydedilir', async () => {
    mockFindOrderByIdLean.mockResolvedValue({
      _id: orderId,
      buyerId,
      items: [{ sellerId: sellerA }, { sellerId: sellerB }],
    });

    await createBuyerSupportTicket(buyerId, {
      subject: 'Sipariş sorunu',
      category: 'order',
      orderId,
      body: 'Yardım',
    });

    expect(mockCreateSupportTicketWithInitialMessage).toHaveBeenCalledWith(
      expect.objectContaining({ sellerId: null }),
      expect.any(Object)
    );
  });

  it('başkasının siparişine talep açamaz', async () => {
    mockFindOrderByIdLean.mockResolvedValue({
      _id: orderId,
      buyerId: 'other-buyer',
      items: [],
    });

    await expect(
      createBuyerSupportTicket(buyerId, {
        subject: 'Sipariş sorunu',
        category: 'order',
        orderId,
        body: 'Yardım',
      })
    ).rejects.toBeInstanceOf(CommerceError);
  });
});

describe('listAdminSupportTickets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListSupportTicketsLean.mockResolvedValue({ items: [], total: 0 });
  });

  it('support.read yetkisi gerekir', async () => {
    await expect(
      listAdminSupportTickets(noSupportCtx, { limit: 20, offset: 0 })
    ).rejects.toBeInstanceOf(AuthError);
  });

  it('support.read ile listeler', async () => {
    const result = await listAdminSupportTickets(supportReaderCtx, { limit: 20, offset: 0 });
    expect(result.total).toBe(0);
  });
});

describe('getSellerSupportTicket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('çok satıcılı sipariş talebine ilgili satıcı erişebilir', async () => {
    mockFindSupportTicketByIdOrThrow.mockResolvedValue({
      _id: ticketId,
      buyerId,
      sellerId: null,
      orderId,
      status: 'open',
    });
    mockFindOrderByIdLean.mockResolvedValue({
      _id: orderId,
      items: [{ sellerId: sellerA }, { sellerId: sellerB }],
    });

    const result = await getSellerSupportTicket(sellerA, ticketId);

    expect(result.ticket.id).toBe(ticketId);
  });
});

describe('postBuyerSupportMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindSupportTicketByIdOrThrow.mockResolvedValue({
      _id: ticketId,
      buyerId,
      status: 'open',
    });
    mockCreateSupportMessage.mockResolvedValue({
      _id: 'msg-2',
      ticketId,
      authorUserId: buyerId,
      authorRole: 'buyer',
      body: 'Cevap',
      isInternal: false,
      toObject: () => ({
        _id: 'msg-2',
        ticketId,
        authorUserId: buyerId,
        authorRole: 'buyer',
        body: 'Cevap',
        isInternal: false,
      }),
    });
  });

  it('kapalı talebe mesaj gönderilemez', async () => {
    mockFindSupportTicketByIdOrThrow.mockResolvedValue({
      _id: ticketId,
      buyerId,
      status: 'closed',
    });

    await expect(
      postBuyerSupportMessage(buyerId, ticketId, { body: 'Cevap' })
    ).rejects.toBeInstanceOf(CommerceError);
  });
});
