import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListApprovedPaymentSplitsLean = vi.fn();
const mockFindSellerWalletLedgerEntry = vi.fn();
const mockReleaseSellerAvailableFromSplit = vi.fn();

vi.mock('@/repositories/buyers/payment-split.repository', () => ({
  listApprovedPaymentSplitsLean: (...args: unknown[]) => mockListApprovedPaymentSplitsLean(...args),
}));

vi.mock('@/repositories/sellers/seller-wallet.repository', () => ({
  findSellerWalletLedgerEntry: (...args: unknown[]) => mockFindSellerWalletLedgerEntry(...args),
}));

vi.mock('@/domain/sellers/wallet/release-available-from-split', () => ({
  releaseSellerAvailableFromSplit: (...args: unknown[]) => mockReleaseSellerAvailableFromSplit(...args),
}));

import { reconcileSellerWalletReleases } from '@/domain/sellers/wallet/reconcile-seller-wallet-releases';

describe('reconcileSellerWalletReleases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReleaseSellerAvailableFromSplit.mockResolvedValue(undefined);
  });

  it('onaylı split için eksik available release kaydını tamamlar', async () => {
    mockListApprovedPaymentSplitsLean.mockResolvedValue([
      {
        _id: 'split-1',
        orderId: 'order-1',
        sellerId: 'seller-1',
        sellerShare: 180,
      },
    ]);
    mockFindSellerWalletLedgerEntry.mockResolvedValue(null);

    const count = await reconcileSellerWalletReleases();

    expect(count).toBe(1);
    expect(mockReleaseSellerAvailableFromSplit).toHaveBeenCalledWith({
      _id: 'split-1',
      orderId: 'order-1',
      sellerId: 'seller-1',
      sellerShare: 180,
    });
  });

  it('mevcut available release kaydı varsa atlar', async () => {
    mockListApprovedPaymentSplitsLean.mockResolvedValue([
      {
        _id: 'split-1',
        orderId: 'order-1',
        sellerId: 'seller-1',
        sellerShare: 180,
      },
    ]);
    mockFindSellerWalletLedgerEntry.mockResolvedValue({ _id: 'ledger-1' });

    const count = await reconcileSellerWalletReleases();

    expect(count).toBe(0);
    expect(mockReleaseSellerAvailableFromSplit).not.toHaveBeenCalled();
  });
});
