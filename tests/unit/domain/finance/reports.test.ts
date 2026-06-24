import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '@/domain/auth/access/admin/permission-keys';
import type { AdminAccessContext } from '@/domain/auth/queries/admin-context';

const mockAggregateSummary = vi.fn();
const mockAggregateBySeller = vi.fn();
const mockListSplits = vi.fn();

vi.mock('@/repositories/finance/finance-report.repository', () => ({
  aggregateFinanceSummary: (...args: unknown[]) => mockAggregateSummary(...args),
  aggregateFinanceBySeller: (...args: unknown[]) => mockAggregateBySeller(...args),
  listFinanceSplitsForExport: (...args: unknown[]) => mockListSplits(...args),
}));

import {
  exportFinanceSplitsCsv,
  getFinanceBySeller,
  getFinanceSummary,
} from '@/domain/finance/reports';
import { AuthError } from '@/domain/auth/errors';

const financeReaderCtx: AdminAccessContext = {
  userId: 'admin-1',
  roleId: 'role-1',
  roleSlug: 'finance',
  roleName: 'Finance',
  permissions: new Set([PERMISSIONS.FINANCE_READ, PERMISSIONS.FINANCE_EXPORT]),
  isOwner: false,
};

const noFinanceCtx: AdminAccessContext = {
  ...financeReaderCtx,
  permissions: new Set([PERMISSIONS.ORDERS_READ]),
};

describe('getFinanceSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAggregateSummary.mockResolvedValue({
      totalSubtotal: 5000,
      totalCommission: 500,
      totalSellerShare: 4500,
      splitCount: 10,
    });
  });

  it('finans özetini döner', async () => {
    const result = await getFinanceSummary(financeReaderCtx, {
      from: '2026-01-01',
      to: '2026-06-01',
    });

    expect(result.splitCount).toBe(10);
    expect(result.totalSubtotal).toBe(5000);
    expect(result.from).toBeInstanceOf(Date);
    expect(mockAggregateSummary).toHaveBeenCalled();
  });

  it('yetki yoksa hata fırlatır', async () => {
    await expect(getFinanceSummary(noFinanceCtx, {})).rejects.toBeInstanceOf(AuthError);
  });
});

describe('getFinanceBySeller', () => {
  beforeEach(() => {
    mockAggregateBySeller.mockResolvedValue([
      { sellerId: 's1', totalSubtotal: 1000, totalCommission: 100, totalSellerShare: 900, splitCount: 5 },
    ]);
  });

  it('satıcı bazlı raporu döner', async () => {
    const result = await getFinanceBySeller(financeReaderCtx, { limit: 10 });

    expect(result.sellers).toHaveLength(1);
    expect(mockAggregateBySeller).toHaveBeenCalledWith(undefined, undefined, 10);
  });
});

describe('exportFinanceSplitsCsv', () => {
  beforeEach(() => {
    mockListSplits.mockResolvedValue([
      {
        orderId: 'o1',
        productId: 'p1',
        sellerId: 's1',
        subtotal: 100,
        commissionAmount: 10,
        sellerShare: 90,
        approvalStatus: 'approved',
        updatedAt: new Date('2026-01-01'),
      },
    ]);
  });

  it('csv başlığı ve satır üretir', async () => {
    const csv = await exportFinanceSplitsCsv(financeReaderCtx, {});

    expect(csv.split('\n')[0]).toContain('orderId');
    expect(csv).toContain('o1');
    expect(csv).toContain('approved');
  });

  it('export yetkisi yoksa hata fırlatır', async () => {
    await expect(
      exportFinanceSplitsCsv(
        { ...financeReaderCtx, permissions: new Set([PERMISSIONS.FINANCE_READ]) },
        {}
      )
    ).rejects.toBeInstanceOf(AuthError);
  });
});
