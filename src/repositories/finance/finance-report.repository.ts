import { PaymentSplit } from '@/infrastructure/mongo';

export const aggregateFinanceSummary = async (from?: Date, to?: Date) => {
  const match: Record<string, unknown> = { approvalStatus: 'approved' };

  if (from || to) {
    match.updatedAt = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    };
  }

  const [totals] = await PaymentSplit.aggregate<{
    totalSubtotal: number;
    totalCommission: number;
    totalSellerShare: number;
    splitCount: number;
  }>([
    { $match: match },
    {
      $group: {
        _id: null,
        totalSubtotal: { $sum: '$subtotal' },
        totalCommission: { $sum: '$commissionAmount' },
        totalSellerShare: { $sum: '$sellerShare' },
        splitCount: { $sum: 1 },
      },
    },
  ]);

  return {
    totalSubtotal: totals?.totalSubtotal ?? 0,
    totalCommission: totals?.totalCommission ?? 0,
    totalSellerShare: totals?.totalSellerShare ?? 0,
    splitCount: totals?.splitCount ?? 0,
  };
};

export const aggregateFinanceBySeller = async (from?: Date, to?: Date, limit = 50) => {
  const match: Record<string, unknown> = { approvalStatus: 'approved' };

  if (from || to) {
    match.updatedAt = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    };
  }

  return PaymentSplit.aggregate<{
    sellerId: string;
    totalSubtotal: number;
    totalCommission: number;
    totalSellerShare: number;
    splitCount: number;
  }>([
    { $match: match },
    {
      $group: {
        _id: '$sellerId',
        totalSubtotal: { $sum: '$subtotal' },
        totalCommission: { $sum: '$commissionAmount' },
        totalSellerShare: { $sum: '$sellerShare' },
        splitCount: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        sellerId: '$_id',
        totalSubtotal: 1,
        totalCommission: 1,
        totalSellerShare: 1,
        splitCount: 1,
      },
    },
    { $sort: { totalSubtotal: -1 } },
    { $limit: limit },
  ]);
};

export const listFinanceSplitsForExport = async (from?: Date, to?: Date, limit = 5000) => {
  const query: Record<string, unknown> = { approvalStatus: 'approved' };

  if (from || to) {
    query.updatedAt = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    };
  }

  return PaymentSplit.find(query).sort({ updatedAt: -1 }).limit(limit).lean();
};
