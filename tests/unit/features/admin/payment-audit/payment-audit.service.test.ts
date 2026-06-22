import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListPaymentAuditLogsByOrderIdLean = vi.fn();

vi.mock('@/domains/payments/infrastructure/repositories/payment-audit-log.repository', () => ({
  listPaymentAuditLogsByOrderIdLean: (...args: unknown[]) =>
    mockListPaymentAuditLogsByOrderIdLean(...args),
}));

import { PERMISSIONS } from '@/domains/identity/application/access/admin/permission-keys';
import type { AdminAccessContext } from '@/domains/identity/application/queries/admin-context';
import { listPaymentAuditLogs } from '@/api/admin/payment-audit/payment-audit.service';

const adminCtx: AdminAccessContext = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  roleId: '660e8400-e29b-41d4-a716-446655440001',
  roleSlug: 'owner',
  roleName: 'Owner',
  permissions: new Set([PERMISSIONS.ADMINS_READ]),
  isOwner: true,
};

const orderId = '8c9e6679-7425-40de-944b-e07fc1f90ae8';

describe('listPaymentAuditLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('orderId filtresi ile kayıtları döner', async () => {
    mockListPaymentAuditLogsByOrderIdLean.mockResolvedValue({
      items: [
        {
          _id: 'log-1',
          paymentId: 'pay-1',
          orderId,
          fromStatus: 'pending',
          toStatus: 'completed',
          reason: 'iyzico_checkout_verified',
          metadata: null,
          createdAt: new Date(),
        },
      ],
      total: 1,
    });

    const result = await listPaymentAuditLogs(adminCtx, {
      orderId,
      limit: 20,
      offset: 0,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].orderId).toBe(orderId);
  });

  it('filtre yoksa 400 fırlatır', async () => {
    await expect(
      listPaymentAuditLogs(adminCtx, { limit: 20, offset: 0 })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'orderId veya paymentId filtresi gerekli',
    });
  });
});
