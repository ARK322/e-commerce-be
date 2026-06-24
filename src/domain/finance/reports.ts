import { PERMISSIONS } from '@/domain/auth/access/admin/permission-keys';
import { assertPermission } from '@/domain/auth/access/admin/permissions';
import type { AdminAccessContext } from '@/domain/auth/queries/admin-context';
import {
  aggregateFinanceBySeller,
  aggregateFinanceSummary,
  listFinanceSplitsForExport,
} from '@/repositories/finance/finance-report.repository';

export type FinanceReportQuery = {
  from?: Date;
  to?: Date;
};

const parseDateRange = (query: { from?: string; to?: string }) => ({
  from: query.from ? new Date(query.from) : undefined,
  to: query.to ? new Date(query.to) : undefined,
});

export const getFinanceSummary = async (
  ctx: AdminAccessContext,
  query: { from?: string; to?: string }
) => {
  assertPermission(ctx, PERMISSIONS.FINANCE_READ, 'Finans raporlarını görüntüleme yetkin yok');

  const range = parseDateRange(query);
  const summary = await aggregateFinanceSummary(range.from, range.to);

  return {
    ...summary,
    from: range.from ?? null,
    to: range.to ?? null,
  };
};

export const getFinanceBySeller = async (
  ctx: AdminAccessContext,
  query: { from?: string; to?: string; limit?: number }
) => {
  assertPermission(ctx, PERMISSIONS.FINANCE_READ, 'Finans raporlarını görüntüleme yetkin yok');

  const range = parseDateRange(query);
  const sellers = await aggregateFinanceBySeller(range.from, range.to, query.limit ?? 50);

  return {
    sellers,
    from: range.from ?? null,
    to: range.to ?? null,
  };
};

export const exportFinanceSplitsCsv = async (
  ctx: AdminAccessContext,
  query: { from?: string; to?: string }
) => {
  assertPermission(ctx, PERMISSIONS.FINANCE_EXPORT, 'Finans dışa aktarma yetkin yok');

  const range = parseDateRange(query);
  const splits = await listFinanceSplitsForExport(range.from, range.to);

  const header = [
    'orderId',
    'productId',
    'sellerId',
    'subtotal',
    'commissionAmount',
    'sellerShare',
    'approvalStatus',
    'updatedAt',
  ];

  const rows = splits.map((split) =>
    [
      split.orderId,
      split.productId,
      split.sellerId,
      split.subtotal,
      split.commissionAmount,
      split.sellerShare,
      split.approvalStatus,
      split.updatedAt?.toISOString() ?? '',
    ].join(',')
  );

  return [header.join(','), ...rows].join('\n');
};
