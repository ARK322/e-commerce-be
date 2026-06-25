import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '@/domain/auth/access/admin/permission-keys';
import type { AdminAccessContext } from '@/domain/auth/queries/admin-context';

const mockFindBuyerOrder = vi.fn();
const mockFindOrderByIdForUpdate = vi.fn();
const mockFindPaymentByOrderId = vi.fn();
const mockRefundCaptured = vi.fn();
const mockFindReturnRequestForUpdate = vi.fn();
const mockSaveReturnRequest = vi.fn();
const mockSaveOrder = vi.fn();
const mockFindPendingReturn = vi.fn();
const mockCreateReturnRequest = vi.fn();
const mockEnqueueOutbox = vi.fn();
const mockFindBuyerProfile = vi.fn();
const mockRecordAdminAction = vi.fn();

vi.mock('@/repositories/buyers/order.repository', () => ({
  findBuyerOrder: (...args: unknown[]) => mockFindBuyerOrder(...args),
  findOrderByIdForUpdate: (...args: unknown[]) => mockFindOrderByIdForUpdate(...args),
  saveOrderDocument: (...args: unknown[]) => mockSaveOrder(...args),
}));

vi.mock('@/repositories/buyers/payment.repository', () => ({
  findPaymentByOrderId: (...args: unknown[]) => mockFindPaymentByOrderId(...args),
}));

vi.mock('@/domain/payment/refund-captured-payment', () => ({
  refundCapturedIyzicoPayment: (...args: unknown[]) => mockRefundCaptured(...args),
}));

vi.mock('@/repositories/orders/return-request.repository', () => ({
  createReturnRequest: (...args: unknown[]) => mockCreateReturnRequest(...args),
  findPendingReturnByOrderLean: (...args: unknown[]) => mockFindPendingReturn(...args),
  findReturnRequestForUpdate: (...args: unknown[]) => mockFindReturnRequestForUpdate(...args),
  listReturnRequestsByBuyerLean: vi.fn().mockResolvedValue([]),
  listReturnRequestsLean: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  saveReturnRequestDocument: (...args: unknown[]) => mockSaveReturnRequest(...args),
}));

vi.mock('@/domain/notification/outbox/enqueue-outbox-event', () => ({
  enqueueOutboxEvent: (...args: unknown[]) => mockEnqueueOutbox(...args),
  OUTBOX_EVENT_TYPES: {
    EMAIL_RETURN_REQUESTED: 'email.return.requested',
    EMAIL_RETURN_RESOLVED: 'email.return.resolved',
  },
}));

vi.mock('@/repositories/buyers/buyer.repository', () => ({
  findBuyerPaymentProfileLean: (...args: unknown[]) => mockFindBuyerProfile(...args),
}));

vi.mock('@/domain/orders/reverse-return-settlement', () => ({
  reverseSettlementForReturn: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/domain/auth/admin/admin-audit', () => ({
  recordAdminAction: (...args: unknown[]) => mockRecordAdminAction(...args),
}));

vi.mock('@/shared/ids', () => ({
  createUserId: () => 'return-request-id',
}));

import { reviewAdminReturnRequest } from '@/domain/orders/return-requests';

const buyerId = '550e8400-e29b-41d4-a716-446655440000';
const orderId = '8c9e6679-7425-40de-944b-e07fc1f90ae8';
const requestId = '9c9e6679-7425-40de-944b-e07fc1f90ae9';
const adminId = '660e8400-e29b-41d4-a716-446655440001';

const adminCtx: AdminAccessContext = {
  userId: adminId,
  roleId: 'role-1',
  roleSlug: 'support',
  roleName: 'Support',
  permissions: new Set([PERMISSIONS.RETURNS_WRITE]),
  isOwner: false,
};

const buildReturnRequest = () => ({
  _id: requestId,
  orderId,
  buyerId,
  type: 'return' as const,
  status: 'pending',
  items: [{ productId: 'p1', quantity: 1, reason: 'defective' }],
  buyerNote: null,
  adminNote: null,
  reviewedByAdminId: null,
  reviewedAt: null,
  refundPaymentId: null,
  refundAmount: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  save: vi.fn(),
});

describe('reviewAdminReturnRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindBuyerProfile.mockResolvedValue({ user: { email: 'buyer@test.com' } });
    mockRefundCaptured.mockResolvedValue(true);
    mockSaveReturnRequest.mockResolvedValue(undefined);
    mockSaveOrder.mockResolvedValue(undefined);
  });

  it('kısmi iade onayında hesaplanan tutarı iade eder', async () => {
    const request = buildReturnRequest();
    mockFindReturnRequestForUpdate.mockResolvedValue(request);
    mockFindOrderByIdForUpdate.mockResolvedValue({
      _id: orderId,
      status: 'delivered',
      totalAmount: 300,
      items: [
        { productId: 'p1', quantity: 2, subtotal: 200 },
        { productId: 'p2', quantity: 1, subtotal: 100 },
      ],
    });
    mockFindPaymentByOrderId.mockResolvedValue({
      _id: 'pay-1',
      amount: 300,
      refundedAmount: 0,
      status: 'completed',
      externalId: 'iyzico-pay-1',
    });

    const result = await reviewAdminReturnRequest(adminCtx, requestId, {
      decision: 'approved',
    });

    expect(mockRefundCaptured).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'pay-1' }),
      'iyzico-pay-1',
      `return_request_${requestId}`,
      100
    );
    expect(result.refundAmount).toBe(100);
    expect(mockSaveReturnRequest).toHaveBeenCalled();
    expect(mockEnqueueOutbox).toHaveBeenCalled();
  });

  it('tam iade sonrası ödeme tamamen iade edildiyse siparişi iptal eder', async () => {
    const request = buildReturnRequest();
    request.items = [
      { productId: 'p1', quantity: 2, reason: 'defective' },
      { productId: 'p2', quantity: 1, reason: 'defective' },
    ];

    mockFindReturnRequestForUpdate.mockResolvedValue(request);
    const orderDoc = {
      _id: orderId,
      status: 'delivered',
      totalAmount: 300,
      items: [
        { productId: 'p1', quantity: 2, subtotal: 200 },
        { productId: 'p2', quantity: 1, subtotal: 100 },
      ],
      updatedAt: undefined as Date | undefined,
    };
    mockFindOrderByIdForUpdate.mockResolvedValue(orderDoc);
    mockFindPaymentByOrderId.mockResolvedValue({
      _id: 'pay-1',
      amount: 300,
      refundedAmount: 0,
      status: 'completed',
      externalId: 'iyzico-pay-1',
    });
    mockRefundCaptured.mockImplementation(async (payment) => {
      payment.refundedAmount = 300;
      return true;
    });

    await reviewAdminReturnRequest(adminCtx, requestId, { decision: 'approved' });

    expect(orderDoc.status).toBe('cancelled');
    expect(mockSaveOrder).toHaveBeenCalledWith(orderDoc);
  });
});
