import { env } from '@/config/env';

export const getPlatformCommissionRate = (): number => env.platformCommissionRate;

export type ItemSplitAmounts = {
  subtotal: number;
  commissionAmount: number;
  sellerShare: number;
};

export const calcItemSplit = (
  subtotal: number,
  rate: number = getPlatformCommissionRate()
): ItemSplitAmounts => {
  const commissionAmount = Math.round(subtotal * rate * 100) / 100;
  const sellerShare = Math.round((subtotal - commissionAmount) * 100) / 100;

  return {
    subtotal,
    commissionAmount,
    sellerShare,
  };
};
