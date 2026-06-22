import type { SupportAuthorRole } from '@/infrastructure/mongo';
import { SupportMessage } from '@/infrastructure/mongo';
import { createUserId } from '@/shared/ids';

export type CreateSupportMessageData = {
  ticketId: string;
  authorUserId: string;
  authorRole: SupportAuthorRole;
  body: string;
  isInternal?: boolean;
};

export const createSupportMessage = async (data: CreateSupportMessageData) =>
  SupportMessage.create({
    _id: createUserId(),
    ...data,
    isInternal: data.isInternal ?? false,
  });

export type ListSupportMessagesFilters = {
  ticketId: string;
  since?: Date;
  includeInternal?: boolean;
};

export const listSupportMessagesLean = async (
  filters: ListSupportMessagesFilters,
  limit: number,
  offset: number
) => {
  const query: Record<string, unknown> = {
    ticketId: filters.ticketId,
  };

  if (filters.since) {
    query.createdAt = { $gt: filters.since };
  }

  if (!filters.includeInternal) {
    query.isInternal = false;
  }

  const [items, total] = await Promise.all([
    SupportMessage.find(query).sort({ createdAt: 1 }).skip(offset).limit(limit).lean(),
    SupportMessage.countDocuments(query),
  ]);

  return { items, total };
};
