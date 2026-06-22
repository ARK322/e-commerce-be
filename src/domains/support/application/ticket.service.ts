import { PERMISSIONS } from '@/domains/identity/application/access/admin/permission-keys';
import { assertPermission } from '@/domains/identity/application/access/admin/permissions';
import { recordAdminAction } from '@/domains/identity/application/admin/admin-audit';
import type { AdminAccessContext } from '@/domains/identity/application/queries/admin-context';
import { CommerceError } from '@/shared/errors/commerce-error';
import type {
  AdminPostSupportMessageInput,
  CreateSupportTicketInput,
  PostSupportMessageInput,
} from '@/domains/support/application/support.schemas';
import type {
  ListSupportMessagesQuery,
  ListSupportTicketsQuery,
  UpdateSupportTicketInput,
} from '@/domains/support/application/support-query.schemas';
import { getOrderByIdLean } from '@/domains/commerce/application';
import {
  createSupportMessage,
  listSupportMessagesLean,
} from '@/domains/support/infrastructure/repositories/support-message.repository';
import {
  createSupportTicket,
  findSupportTicketByIdOrThrow,
  listSupportTicketsLean,
  touchSupportTicketLastMessageAt,
  updateSupportTicketById,
} from '@/domains/support/infrastructure/repositories/support-ticket.repository';

type TicketRecord = {
  _id: unknown;
  subject: string;
  status: string;
  category: string;
  orderId?: string | null;
  buyerId: string;
  sellerId?: string | null;
  createdByUserId: string;
  createdByRole: string;
  assignedAdminId?: string | null;
  lastMessageAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

type MessageRecord = {
  _id: unknown;
  ticketId: string;
  authorUserId: string;
  authorRole: string;
  body: string;
  isInternal?: boolean;
  createdAt?: Date;
};

const toTicketResponse = (ticket: TicketRecord) => ({
  id: String(ticket._id),
  subject: ticket.subject,
  status: ticket.status,
  category: ticket.category,
  orderId: ticket.orderId ?? null,
  buyerId: ticket.buyerId,
  sellerId: ticket.sellerId ?? null,
  createdByUserId: ticket.createdByUserId,
  createdByRole: ticket.createdByRole,
  assignedAdminId: ticket.assignedAdminId ?? null,
  lastMessageAt: ticket.lastMessageAt,
  createdAt: ticket.createdAt,
  updatedAt: ticket.updatedAt,
});

const toMessageResponse = (message: MessageRecord) => ({
  id: String(message._id),
  ticketId: message.ticketId,
  authorUserId: message.authorUserId,
  authorRole: message.authorRole,
  body: message.body,
  isInternal: message.isInternal ?? false,
  createdAt: message.createdAt,
});

const resolveOrderContext = async (
  orderId: string | undefined,
  options: {
    buyerId?: string;
    sellerId?: string;
  }
) => {
  if (!orderId) {
    return { orderId: null, buyerId: options.buyerId, sellerId: options.sellerId ?? null };
  }

  const order = await getOrderByIdLean(orderId);

  if (!order) {
    throw new CommerceError(404, 'Sipariş bulunamadı');
  }

  if (options.buyerId && order.buyerId !== options.buyerId) {
    throw new CommerceError(403, 'Bu siparişe erişim yetkin yok');
  }

  if (options.sellerId) {
    const hasSellerItem = order.items.some((item) => item.sellerId === options.sellerId);

    if (!hasSellerItem) {
      throw new CommerceError(403, 'Bu siparişe erişim yetkin yok');
    }
  }

  const sellerIds = [...new Set(order.items.map((item) => item.sellerId))];

  return {
    orderId,
    buyerId: order.buyerId,
    sellerId: options.sellerId ?? (sellerIds.length === 1 ? sellerIds[0] : null),
  };
};

const assertBuyerTicketAccess = (ticket: TicketRecord, buyerId: string) => {
  if (ticket.buyerId !== buyerId) {
    throw new CommerceError(403, 'Bu destek talebine erişim yetkin yok');
  }
};

const assertSellerTicketAccess = (ticket: TicketRecord, sellerId: string) => {
  if (ticket.sellerId !== sellerId) {
    throw new CommerceError(403, 'Bu destek talebine erişim yetkin yok');
  }
};

const assertTicketOpenForMessages = (ticket: TicketRecord) => {
  if (ticket.status === 'closed') {
    throw new CommerceError(400, 'Kapalı destek talebine mesaj gönderilemez');
  }
};

const createTicketWithInitialMessage = async (
  ticketData: Parameters<typeof createSupportTicket>[0],
  message: { authorUserId: string; authorRole: 'buyer' | 'seller' | 'admin'; body: string; isInternal?: boolean }
) => {
  const ticket = await createSupportTicket(ticketData);
  const createdMessage = await createSupportMessage({
    ticketId: String(ticket._id),
    authorUserId: message.authorUserId,
    authorRole: message.authorRole,
    body: message.body,
    isInternal: message.isInternal ?? false,
  });

  return {
    ticket: toTicketResponse(ticket.toObject() as TicketRecord),
    initialMessage: toMessageResponse(createdMessage.toObject() as MessageRecord),
  };
};

export const createBuyerSupportTicket = async (buyerId: string, input: CreateSupportTicketInput) => {
  const orderContext = await resolveOrderContext(input.orderId, { buyerId });

  return createTicketWithInitialMessage(
    {
      subject: input.subject,
      category: input.category,
      orderId: orderContext.orderId,
      buyerId: orderContext.buyerId!,
      sellerId: orderContext.sellerId,
      createdByUserId: buyerId,
      createdByRole: 'buyer',
    },
    {
      authorUserId: buyerId,
      authorRole: 'buyer',
      body: input.body,
    }
  );
};

export const createSellerSupportTicket = async (sellerId: string, input: CreateSupportTicketInput) => {
  const orderContext = await resolveOrderContext(input.orderId, { sellerId });

  if (!orderContext.buyerId) {
    throw new CommerceError(400, 'Satıcı destek talebi için sipariş bilgisi gerekli');
  }

  return createTicketWithInitialMessage(
    {
      subject: input.subject,
      category: input.category,
      orderId: orderContext.orderId,
      buyerId: orderContext.buyerId,
      sellerId,
      createdByUserId: sellerId,
      createdByRole: 'seller',
    },
    {
      authorUserId: sellerId,
      authorRole: 'seller',
      body: input.body,
    }
  );
};

export const listBuyerSupportTickets = async (buyerId: string, query: ListSupportTicketsQuery) => {
  const { items, total } = await listSupportTicketsLean(
    {
      buyerId,
      status: query.status,
      orderId: query.orderId,
    },
    query.limit,
    query.offset
  );

  return {
    items: items.map((ticket) => toTicketResponse(ticket as TicketRecord)),
    total,
    limit: query.limit,
    offset: query.offset,
  };
};

export const listSellerSupportTickets = async (sellerId: string, query: ListSupportTicketsQuery) => {
  const { items, total } = await listSupportTicketsLean(
    {
      sellerId,
      status: query.status,
      orderId: query.orderId,
    },
    query.limit,
    query.offset
  );

  return {
    items: items.map((ticket) => toTicketResponse(ticket as TicketRecord)),
    total,
    limit: query.limit,
    offset: query.offset,
  };
};

export const getBuyerSupportTicket = async (buyerId: string, ticketId: string) => {
  const ticket = await findSupportTicketByIdOrThrow(ticketId);
  assertBuyerTicketAccess(ticket as TicketRecord, buyerId);
  return { ticket: toTicketResponse(ticket as TicketRecord) };
};

export const getSellerSupportTicket = async (sellerId: string, ticketId: string) => {
  const ticket = await findSupportTicketByIdOrThrow(ticketId);
  assertSellerTicketAccess(ticket as TicketRecord, sellerId);
  return { ticket: toTicketResponse(ticket as TicketRecord) };
};

export const listBuyerSupportMessages = async (
  buyerId: string,
  ticketId: string,
  query: ListSupportMessagesQuery
) => {
  const ticket = await findSupportTicketByIdOrThrow(ticketId);
  assertBuyerTicketAccess(ticket as TicketRecord, buyerId);

  const { items, total } = await listSupportMessagesLean(
    {
      ticketId,
      since: query.since,
      includeInternal: false,
    },
    query.limit,
    query.offset
  );

  return {
    items: items.map((message) => toMessageResponse(message as MessageRecord)),
    total,
    limit: query.limit,
    offset: query.offset,
  };
};

export const listSellerSupportMessages = async (
  sellerId: string,
  ticketId: string,
  query: ListSupportMessagesQuery
) => {
  const ticket = await findSupportTicketByIdOrThrow(ticketId);
  assertSellerTicketAccess(ticket as TicketRecord, sellerId);

  const { items, total } = await listSupportMessagesLean(
    {
      ticketId,
      since: query.since,
      includeInternal: false,
    },
    query.limit,
    query.offset
  );

  return {
    items: items.map((message) => toMessageResponse(message as MessageRecord)),
    total,
    limit: query.limit,
    offset: query.offset,
  };
};

export const postBuyerSupportMessage = async (
  buyerId: string,
  ticketId: string,
  input: PostSupportMessageInput
) => {
  const ticket = await findSupportTicketByIdOrThrow(ticketId);
  assertBuyerTicketAccess(ticket as TicketRecord, buyerId);
  assertTicketOpenForMessages(ticket as TicketRecord);

  const message = await createSupportMessage({
    ticketId,
    authorUserId: buyerId,
    authorRole: 'buyer',
    body: input.body,
  });

  await touchSupportTicketLastMessageAt(ticketId);

  return { supportMessage: toMessageResponse(message.toObject() as MessageRecord) };
};

export const postSellerSupportMessage = async (
  sellerId: string,
  ticketId: string,
  input: PostSupportMessageInput
) => {
  const ticket = await findSupportTicketByIdOrThrow(ticketId);
  assertSellerTicketAccess(ticket as TicketRecord, sellerId);
  assertTicketOpenForMessages(ticket as TicketRecord);

  const message = await createSupportMessage({
    ticketId,
    authorUserId: sellerId,
    authorRole: 'seller',
    body: input.body,
  });

  await touchSupportTicketLastMessageAt(ticketId);

  return { supportMessage: toMessageResponse(message.toObject() as MessageRecord) };
};

export const listAdminSupportTickets = async (
  ctx: AdminAccessContext,
  query: ListSupportTicketsQuery & { buyerId?: string; sellerId?: string }
) => {
  assertPermission(ctx, PERMISSIONS.SUPPORT_READ, 'Destek taleplerini görüntüleme yetkin yok');

  const { items, total } = await listSupportTicketsLean(
    {
      status: query.status,
      orderId: query.orderId,
      assignedAdminId: query.assignedAdminId,
      buyerId: query.buyerId,
      sellerId: query.sellerId,
    },
    query.limit,
    query.offset
  );

  return {
    items: items.map((ticket) => toTicketResponse(ticket as TicketRecord)),
    total,
    limit: query.limit,
    offset: query.offset,
  };
};

export const getAdminSupportTicket = async (ctx: AdminAccessContext, ticketId: string) => {
  assertPermission(ctx, PERMISSIONS.SUPPORT_READ, 'Destek taleplerini görüntüleme yetkin yok');

  const ticket = await findSupportTicketByIdOrThrow(ticketId);
  return { ticket: toTicketResponse(ticket as TicketRecord) };
};

export const listAdminSupportMessages = async (
  ctx: AdminAccessContext,
  ticketId: string,
  query: ListSupportMessagesQuery
) => {
  assertPermission(ctx, PERMISSIONS.SUPPORT_READ, 'Destek taleplerini görüntüleme yetkin yok');

  await findSupportTicketByIdOrThrow(ticketId);

  const { items, total } = await listSupportMessagesLean(
    {
      ticketId,
      since: query.since,
      includeInternal: true,
    },
    query.limit,
    query.offset
  );

  return {
    items: items.map((message) => toMessageResponse(message as MessageRecord)),
    total,
    limit: query.limit,
    offset: query.offset,
  };
};

export const postAdminSupportMessage = async (
  ctx: AdminAccessContext,
  ticketId: string,
  input: AdminPostSupportMessageInput
) => {
  assertPermission(ctx, PERMISSIONS.SUPPORT_WRITE, 'Destek talebine mesaj gönderme yetkin yok');

  const ticket = await findSupportTicketByIdOrThrow(ticketId);
  assertTicketOpenForMessages(ticket as TicketRecord);

  const message = await createSupportMessage({
    ticketId,
    authorUserId: ctx.userId,
    authorRole: 'admin',
    body: input.body,
    isInternal: input.isInternal,
  });

  await touchSupportTicketLastMessageAt(ticketId);

  await recordAdminAction({
    actorUserId: ctx.userId,
    action: 'support.message_posted',
    resourceType: 'support_ticket',
    resourceId: ticketId,
    metadata: {
      messageId: String(message._id),
      isInternal: input.isInternal,
    },
  });

  return { supportMessage: toMessageResponse(message.toObject() as MessageRecord) };
};

export const updateAdminSupportTicket = async (
  ctx: AdminAccessContext,
  ticketId: string,
  input: UpdateSupportTicketInput
) => {
  assertPermission(ctx, PERMISSIONS.SUPPORT_WRITE, 'Destek talebini güncelleme yetkin yok');

  await findSupportTicketByIdOrThrow(ticketId);

  const updated = await updateSupportTicketById(ticketId, input);

  if (!updated) {
    throw new CommerceError(404, 'Destek talebi bulunamadı');
  }

  await recordAdminAction({
    actorUserId: ctx.userId,
    action: 'support.ticket_updated',
    resourceType: 'support_ticket',
    resourceId: ticketId,
    metadata: { ...input },
  });

  return { ticket: toTicketResponse(updated as TicketRecord) };
};
