import type { ReturnRequestStatus, ReturnRequestType } from '@/infrastructure/mongo';
import { ReturnRequest } from '@/infrastructure/mongo';

export type CreateReturnRequestData = {
  _id: string;
  orderId: string;
  buyerId: string;
  type: ReturnRequestType;
  items: Array<{ productId: string; quantity: number; reason?: string }>;
  buyerNote?: string | null;
};

export const createReturnRequest = async (data: CreateReturnRequestData) =>
  ReturnRequest.create(data);

export const findReturnRequestByIdLean = async (id: string) => ReturnRequest.findById(id).lean();

export const findPendingReturnByOrderLean = async (orderId: string, buyerId: string) =>
  ReturnRequest.findOne({ orderId, buyerId, status: 'pending' }).lean();

export const listReturnRequestsByBuyerLean = async (buyerId: string) =>
  ReturnRequest.find({ buyerId }).sort({ createdAt: -1 }).lean();

export const listReturnRequestsLean = async (filters: {
  status?: ReturnRequestStatus;
  page: number;
  limit: number;
}) => {
  const query = filters.status ? { status: filters.status } : {};
  const skip = (filters.page - 1) * filters.limit;

  const [items, total] = await Promise.all([
    ReturnRequest.find(query).sort({ createdAt: -1 }).skip(skip).limit(filters.limit).lean(),
    ReturnRequest.countDocuments(query),
  ]);

  return { items, total };
};

export const saveReturnRequestDocument = async (doc: {
  status: string;
  adminNote?: string | null;
  reviewedByAdminId?: string | null;
  reviewedAt?: Date | null;
  refundPaymentId?: string | null;
  updatedAt: Date;
  save: () => Promise<unknown>;
}) => doc.save();

export const findReturnRequestForUpdate = async (id: string) => ReturnRequest.findById(id);
