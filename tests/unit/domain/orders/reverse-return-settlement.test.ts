import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindSplit = vi.fn();
const mockSaveSplit = vi.fn();
const mockCreateLedger = vi.fn();
const mockFindLedger = vi.fn();
const mockClawBack = vi.fn();

vi.mock('@/repositories/buyers/payment-split.repository', () => ({
  findPaymentSplitByOrderAndProduct: (...args: unknown[]) => mockFindSplit(...args),
  savePaymentSplitDocument: (...args: unknown[]) => mockSaveSplit(...args),
}));

vi.mock('@/repositories/sellers/seller-wallet.repository', () => ({
  createSellerWalletLedgerEntry: (...args: unknown[]) => mockCreateLedger(...args),
  findSellerWalletLedgerEntry: (...args: unknown[]) => mockFindLedger(...args),
  clawBackSellerWalletForReturn: (...args: unknown[]) => mockClawBack(...args),
}));

vi.mock('@/shared/ids', () => ({
  createUserId: () => 'ledger-entry-id',
}));

import { reverseSettlementForReturn } from '@/domain/orders/reverse-return-settlement';

describe('reverseSettlementForReturn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindLedger.mockResolvedValue(null);
    mockSaveSplit.mockResolvedValue(undefined);
    mockCreateLedger.mockResolvedValue(undefined);
    mockClawBack.mockResolvedValue(undefined);
  });

  it('kısmi iade için oransal satıcı payını geri alır', async () => {
    const splitDoc = {
      _id: 'split-1',
      sellerId: 'seller-1',
      sellerShare: 200,
      commissionAmount: 20,
      reversedSellerShare: 0,
      reversedCommissionAmount: 0,
      approvalStatus: 'approved',
      updatedAt: undefined as Date | undefined,
    };
    mockFindSplit.mockResolvedValue(splitDoc);

    await reverseSettlementForReturn(
      'order-1',
      [{ productId: 'p1', quantity: 2 }],
      [{ productId: 'p1', quantity: 1 }]
    );

    expect(mockClawBack).toHaveBeenCalledWith('seller-1', 100);
    expect(splitDoc.reversedSellerShare).toBe(100);
    expect(mockSaveSplit).toHaveBeenCalledWith(splitDoc);
  });

  it('tam kalem iadesinde split reversed olur', async () => {
    const splitDoc = {
      _id: 'split-1',
      sellerId: 'seller-1',
      sellerShare: 150,
      commissionAmount: 15,
      reversedSellerShare: 0,
      reversedCommissionAmount: 0,
      approvalStatus: 'approved',
      updatedAt: undefined as Date | undefined,
    };
    mockFindSplit.mockResolvedValue(splitDoc);

    await reverseSettlementForReturn(
      'order-1',
      [{ productId: 'p1', quantity: 1 }],
      [{ productId: 'p1', quantity: 1 }]
    );

    expect(splitDoc.approvalStatus).toBe('reversed');
  });
});
