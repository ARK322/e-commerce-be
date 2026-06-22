import type {
  SupportAuthorRole,
  SupportTicketCategory,
  SupportTicketStatus,
} from '@/infrastructure/mongo';
import { Order, SupportMessage, SupportTicket } from '@/infrastructure/mongo';
import { createUserId } from '@/shared/ids';
import { CommerceError } from '@/shared/errors/commerce-error';
import mongoose from 'mongoose';
import type { CreateSupportMessageData } from '@/repositories/support/support-message.repository';

export type CreateSupportTicketData = {
  subject: string;
  category: SupportTicketCategory;
  orderId?: string | null;
  buyerId: string;
  sellerId?: string | null;
  createdByUserId: string;
  createdByRole: SupportAuthorRole;
};

export const createSupportTicket = async (data: CreateSupportTicketData) =>
  SupportTicket.create({
    _id: createUserId(),
    ...data,
    orderId: data.orderId ?? null,
    sellerId: data.sellerId ?? null,
    status: 'open',
    lastMessageAt: new Date(),
  });

export const createSupportTicketWithInitialMessage = async (
  ticketData: CreateSupportTicketData,
  messageData: Omit<CreateSupportMessageData, 'ticketId'>
): Promise<{
  ticket: { toObject: () => Record<string, unknown> };
  message: { toObject: () => Record<string, unknown> };
}> => {
  const session = await mongoose.startSession();

  try {
    let ticketId = '';
    let ticketDoc: { toObject: () => Record<string, unknown> } | null = null;
    let messageDoc: { toObject: () => Record<string, unknown> } | null = null;

    await session.withTransaction(async () => {
      ticketId = createUserId();
      const [ticket] = await SupportTicket.create(
        [
          {
            _id: ticketId,
            ...ticketData,
            orderId: ticketData.orderId ?? null,
            sellerId: ticketData.sellerId ?? null,
            status: 'open',
            lastMessageAt: new Date(),
          },
        ],
        { session }
      );
      ticketDoc = ticket;

      const [message] = await SupportMessage.create(
        [
          {
            _id: createUserId(),
            ticketId,
            ...messageData,
            isInternal: messageData.isInternal ?? false,
          },
        ],
        { session }
      );
      messageDoc = message;
    });

    if (!ticketDoc || !messageDoc) {
      throw new CommerceError(500, 'Destek talebi oluşturulamadı');
    }

    return { ticket: ticketDoc, message: messageDoc };
  } finally {
    await session.endSession();
  }
};

export const findSupportTicketByIdLean = async (ticketId: string) =>
  SupportTicket.findById(ticketId).lean();

export const findSupportTicketByIdOrThrow = async (ticketId: string) => {
  const ticket = await findSupportTicketByIdLean(ticketId);

  if (!ticket) {
    throw new CommerceError(404, 'Destek talebi bulunamadı');
  }

  return ticket;
};

export type ListSupportTicketsFilters = {
  status?: SupportTicketStatus;
  buyerId?: string;
  sellerId?: string;
  orderId?: string;
  assignedAdminId?: string;
};

export const listSupportTicketsLean = async (
  filters: ListSupportTicketsFilters,
  limit: number,
  offset: number
) => {
  const query: Record<string, unknown> = {};

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.buyerId) {
    query.buyerId = filters.buyerId;
  }

  if (filters.sellerId) {
    query.sellerId = filters.sellerId;
  }

  if (filters.orderId) {
    query.orderId = filters.orderId;
  }

  if (filters.assignedAdminId) {
    query.assignedAdminId = filters.assignedAdminId;
  }

  const [items, total] = await Promise.all([
    SupportTicket.find(query).sort({ lastMessageAt: -1 }).skip(offset).limit(limit).lean(),
    SupportTicket.countDocuments(query),
  ]);

  return { items, total };
};

export const listSupportTicketsForSellerLean = async (
  sellerId: string,
  filters: Omit<ListSupportTicketsFilters, 'sellerId' | 'buyerId'>,
  limit: number,
  offset: number
) => {
  const orderIds = await Order.find({ 'items.sellerId': sellerId }).distinct('_id');
  const orderIdList = orderIds.map((id) => String(id));

  const query: Record<string, unknown> = {
    $or: [
      { sellerId },
      ...(orderIdList.length > 0 ? [{ sellerId: null, orderId: { $in: orderIdList } }] : []),
    ],
  };

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.orderId) {
    query.orderId = filters.orderId;
  }

  if (filters.assignedAdminId) {
    query.assignedAdminId = filters.assignedAdminId;
  }

  const [items, total] = await Promise.all([
    SupportTicket.find(query).sort({ lastMessageAt: -1 }).skip(offset).limit(limit).lean(),
    SupportTicket.countDocuments(query),
  ]);

  return { items, total };
};

export type UpdateSupportTicketData = {
  status?: SupportTicketStatus;
  assignedAdminId?: string | null;
};

export const updateSupportTicketById = async (ticketId: string, data: UpdateSupportTicketData) =>
  SupportTicket.findByIdAndUpdate(
    ticketId,
    {
      ...data,
      updatedAt: new Date(),
    },
    { new: true }
  ).lean();

export const touchSupportTicketLastMessageAt = async (ticketId: string) =>
  SupportTicket.findByIdAndUpdate(ticketId, {
    lastMessageAt: new Date(),
    updatedAt: new Date(),
  });
