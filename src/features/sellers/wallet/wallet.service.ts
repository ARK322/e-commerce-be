import { CommerceError } from '@/internal/common/errors/commerce-error';
import {
  findSellerWalletById,
  listSellerWalletLedgerBySellerIdLean,
} from '@/repositories/sellers/seller-wallet.repository';

export const getSellerWalletSummary = async (sellerId: string) => {
  const wallet = await findSellerWalletById(sellerId);
  const ledger = await listSellerWalletLedgerBySellerIdLean(sellerId, 20);

  if (!wallet && ledger.length === 0) {
    return {
      pendingBalance: 0,
      availableBalance: 0,
      currency: 'TRY' as const,
      ledger: [],
      settlementNote:
        'Ödemeler teslimat sonrası Iyzico üzerinden banka hesabınıza aktarılır. Bekleyen tutar, teslim edilmemiş siparişlerinizdir.',
    };
  }

  return {
    pendingBalance: wallet?.pendingBalance ?? 0,
    availableBalance: wallet?.availableBalance ?? 0,
    currency: (wallet?.currency ?? 'TRY') as 'TRY',
    ledger: ledger.map((entry) => ({
      id: String(entry._id),
      orderId: entry.orderId,
      entryType: entry.entryType,
      amount: entry.amount,
      createdAt: entry.createdAt,
    })),
    settlementNote:
      'Ödemeler teslimat sonrası Iyzico üzerinden banka hesabınıza aktarılır. Bekleyen tutar, teslim edilmemiş siparişlerinizdir.',
  };
};

export const getSellerWalletForCompany = async (companyId: string) => {
  if (!companyId) {
    throw new CommerceError(400, 'Satıcı bağlamı bulunamadı');
  }

  return getSellerWalletSummary(companyId);
};
