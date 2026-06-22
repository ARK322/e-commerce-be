import type {
  SupportAuthorRole,
  SupportTicketCategory,
  SupportTicketStatus,
} from '@/integrations/mongo';
import { SupportTicket } from '@/integrations/mongo';
import { createUserId } from '@/shared/ids';
import { CommerceError } from '@/shared/errors/commerce-error';

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
