import type { ReturnRequestType, ReturnRequestStatus } from '@/infrastructure/mongo';
import { CommerceError } from '@/shared/errors/commerce-error';
import { createUserId } from '@/shared/ids';
import { PERMISSIONS } from '@/domain/auth/access/admin/permission-keys';
import { assertPermission } from '@/domain/auth/access/admin/permissions';
import { recordAdminAction } from '@/domain/auth/admin/admin-audit';
import type { AdminAccessContext } from '@/domain/auth/queries/admin-context';
import { refundCapturedIyzicoPayment } from '@/domain/payment/refund-captured-payment';
import { enqueueOutboxEvent, OUTBOX_EVENT_TYPES } from '@/domain/notification/outbox/enqueue-outbox-event';
import {
  calculateReturnRefundAmount,
  isFullOrderReturn,
} from '@/domain/orders/return-refund-amount';
import { findBuyerPaymentProfileLean } from '@/repositories/buyers/buyer.repository';
import {
  findBuyerOrder,
  findOrderByIdForUpdate,
  saveOrderDocument,
} from '@/repositories/buyers/order.repository';
import { findPaymentByOrderId } from '@/repositories/buyers/payment.repository';
import {
  createReturnRequest,
  findPendingReturnByOrderLean,
  findReturnRequestForUpdate,
  listReturnRequestsByBuyerLean,
  listReturnRequestsLean,
  saveReturnRequestDocument,
} from '@/repositories/orders/return-request.repository';

export type CreateReturnRequestInput = {
  type: ReturnRequestType;
  items: Array<{ productId: string; quantity: number; reason?: string }>;
  buyerNote?: string;
};

const toReturnResponse = (record: {
  _id: unknown;
  orderId: string;
  buyerId: string;
  type: string;
  status: string;
  items: Array<{ productId: string; quantity: number; reason?: string | null }>;
  buyerNote?: string | null;
  adminNote?: string | null;
  reviewedByAdminId?: string | null;
  reviewedAt?: Date | null;
  refundAmount?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}) => ({
  id: String(record._id),
  orderId: record.orderId,
  buyerId: record.buyerId,
  type: record.type,
  status: record.status,
  items: record.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    reason: item.reason ?? null,
  })),
  buyerNote: record.buyerNote ?? null,
  adminNote: record.adminNote ?? null,
  reviewedByAdminId: record.reviewedByAdminId ?? null,
  reviewedAt: record.reviewedAt ?? null,
  refundAmount: record.refundAmount ?? null,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const assertReturnableOrder = (order: { status: string }, type: ReturnRequestType) => {
  if (type === 'cancellation') {
    if (order.status !== 'paid' && order.status !== 'pending') {
      throw new CommerceError(400, 'Bu sipariş için iptal talebi oluşturulamaz');
    }
    return;
  }

  if (order.status !== 'paid' && order.status !== 'shipped' && order.status !== 'delivered') {
    throw new CommerceError(400, 'Bu sipariş için iade talebi oluşturulamaz');
  }
};

export const createBuyerReturnRequest = async (
  buyerId: string,
  orderId: string,
  input: CreateReturnRequestInput
) => {
  const order = await findBuyerOrder(buyerId, orderId);

  if (!order) {
    throw new CommerceError(404, 'Sipariş bulunamadı');
  }

  assertReturnableOrder(order, input.type);

  const existingPending = await findPendingReturnByOrderLean(orderId, buyerId);

  if (existingPending) {
    throw new CommerceError(409, 'Bu sipariş için bekleyen bir talep zaten var');
  }

  const orderProductIds = new Set(order.items.map((item) => item.productId));

  for (const item of input.items) {
    if (!orderProductIds.has(item.productId)) {
      throw new CommerceError(400, 'Geçersiz sipariş kalemi');
    }

    const orderItem = order.items.find((entry) => entry.productId === item.productId);

    if (!orderItem || item.quantity > orderItem.quantity) {
      throw new CommerceError(400, 'Geçersiz iade adedi');
    }
  }

  const requestId = createUserId();
  const created = await createReturnRequest({
    _id: requestId,
    orderId,
    buyerId,
    type: input.type,
    items: input.items,
    buyerNote: input.buyerNote ?? null,
  });

  const profile = await findBuyerPaymentProfileLean(buyerId);
  const email = profile.user?.email;

  if (email) {
    await enqueueOutboxEvent(OUTBOX_EVENT_TYPES.EMAIL_RETURN_REQUESTED, {
      email,
      orderId,
      requestId,
    });
  }

  return toReturnResponse({
    _id: created._id,
    orderId: created.orderId,
    buyerId: created.buyerId,
    type: created.type,
    status: created.status,
    items: created.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      reason: item.reason ?? undefined,
    })),
    buyerNote: created.buyerNote,
    adminNote: created.adminNote,
    reviewedByAdminId: created.reviewedByAdminId,
    reviewedAt: created.reviewedAt,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  });
};

export const listBuyerReturnRequests = async (buyerId: string) => {
  const items = await listReturnRequestsByBuyerLean(buyerId);
  return items.map((item) => toReturnResponse(item));
};

export const listAdminReturnRequests = async (
  ctx: AdminAccessContext,
  query: { status?: ReturnRequestStatus; page: number; limit: number }
) => {
  assertPermission(ctx, PERMISSIONS.SUPPORT_READ, 'Destek taleplerini görüntüleme yetkin yok');

  const result = await listReturnRequestsLean(query);

  return {
    items: result.items.map((item) => toReturnResponse(item)),
    total: result.total,
    page: query.page,
    limit: query.limit,
  };
};

export const reviewAdminReturnRequest = async (
  ctx: AdminAccessContext,
  requestId: string,
  input: { decision: 'approved' | 'rejected'; adminNote?: string }
) => {
  assertPermission(ctx, PERMISSIONS.SUPPORT_WRITE, 'İade taleplerini yönetme yetkin yok');

  const request = await findReturnRequestForUpdate(requestId);

  if (!request) {
    throw new CommerceError(404, 'İade talebi bulunamadı');
  }

  if (request.status !== 'pending') {
    throw new CommerceError(400, 'Bu talep zaten incelenmiş');
  }

  if (input.decision === 'rejected') {
    request.status = 'rejected';
    request.adminNote = input.adminNote ?? null;
    request.reviewedByAdminId = ctx.userId;
    request.reviewedAt = new Date();
    request.updatedAt = new Date();
    await saveReturnRequestDocument(request);

    await recordAdminAction({
      actorUserId: ctx.userId,
      action: 'return_request.rejected',
      resourceType: 'return_request',
      resourceId: requestId,
      metadata: { orderId: request.orderId },
    });

    const profile = await findBuyerPaymentProfileLean(request.buyerId);
    if (profile.user?.email) {
      await enqueueOutboxEvent(OUTBOX_EVENT_TYPES.EMAIL_RETURN_RESOLVED, {
        email: profile.user.email,
        orderId: request.orderId,
        status: 'rejected',
      });
    }

    return toReturnResponse({
      _id: request._id,
      orderId: request.orderId,
      buyerId: request.buyerId,
      type: request.type,
      status: request.status,
      items: request.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        reason: item.reason ?? undefined,
      })),
      buyerNote: request.buyerNote,
      adminNote: request.adminNote,
      reviewedByAdminId: request.reviewedByAdminId,
      reviewedAt: request.reviewedAt,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    });
  }

  const order = await findOrderByIdForUpdate(request.orderId);

  if (!order) {
    throw new CommerceError(404, 'Sipariş bulunamadı');
  }

  const payment = await findPaymentByOrderId(request.orderId);

  if (!payment || payment.status !== 'completed' || !payment.externalId) {
    throw new CommerceError(400, 'İade için uygun ödeme kaydı bulunamadı');
  }

  const refundAmount = calculateReturnRefundAmount(
    {
      items: order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        subtotal: item.subtotal,
      })),
      totalAmount: order.totalAmount,
    },
    request.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
    request.type,
    {
      amount: payment.amount,
      refundedAmount: payment.refundedAmount,
    }
  );

  const refunded = await refundCapturedIyzicoPayment(
    payment,
    payment.externalId,
    `return_request_${requestId}`,
    refundAmount
  );

  if (!refunded) {
    throw new CommerceError(502, 'Ödeme iadesi başarısız oldu');
  }

  request.status = 'refunded';
  request.adminNote = input.adminNote ?? null;
  request.reviewedByAdminId = ctx.userId;
  request.reviewedAt = new Date();
  request.refundPaymentId = String(payment._id);
  request.refundAmount = refundAmount;
  request.updatedAt = new Date();
  await saveReturnRequestDocument(request);

  const fullReturn =
    request.type === 'cancellation' ||
    isFullOrderReturn(
      order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        subtotal: item.subtotal,
      })),
      request.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }))
    );

  if (request.type === 'cancellation' && order.status !== 'cancelled') {
    order.status = 'cancelled';
    order.updatedAt = new Date();
    await saveOrderDocument(order);
  } else if (fullReturn && payment.refundedAmount && payment.refundedAmount >= payment.amount - 0.001) {
    order.status = 'cancelled';
    order.updatedAt = new Date();
    await saveOrderDocument(order);
  }

  await recordAdminAction({
    actorUserId: ctx.userId,
    action: 'return_request.approved',
    resourceType: 'return_request',
    resourceId: requestId,
    metadata: {
      orderId: request.orderId,
      refundPaymentId: String(payment._id),
      refundAmount,
    },
  });

  const profile = await findBuyerPaymentProfileLean(request.buyerId);
  if (profile.user?.email) {
    await enqueueOutboxEvent(OUTBOX_EVENT_TYPES.EMAIL_RETURN_RESOLVED, {
      email: profile.user.email,
      orderId: request.orderId,
      status: 'refunded',
      refundAmount,
    });
  }

  return toReturnResponse({
    _id: request._id,
    orderId: request.orderId,
    buyerId: request.buyerId,
    type: request.type,
    status: request.status,
    items: request.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      reason: item.reason ?? undefined,
    })),
    buyerNote: request.buyerNote,
    adminNote: request.adminNote,
    reviewedByAdminId: request.reviewedByAdminId,
    reviewedAt: request.reviewedAt,
    refundAmount: request.refundAmount,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  });
};
