import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindSellersByIdsLean = vi.fn();
const mockFindUsersByIdsLean = vi.fn();
const mockUpsertPaymentSplit = vi.fn();
const mockFindPendingPaymentSplitsForOrder = vi.fn();
const mockApproveIyzicoPaymentItem = vi.fn();

vi.mock('@/repositories/sellers/seller.repository', () => ({
  findSellersByIdsLean: (...args: unknown[]) => mockFindSellersByIdsLean(...args),
}));

vi.mock('@/repositories/auth/user.repository', () => ({
  findUsersByIdsLean: (...args: unknown[]) => mockFindUsersByIdsLean(...args),
}));

vi.mock('@/repositories/buyers/payment-split.repository', () => ({
  upsertPaymentSplit: (...args: unknown[]) => mockUpsertPaymentSplit(...args),
  findPendingPaymentSplitsForOrder: (...args: unknown[]) => mockFindPendingPaymentSplitsForOrder(...args),
  savePaymentSplitDocument: (split: { save: () => Promise<unknown> }) => split.save(),
}));

vi.mock('@/shared/ids', () => ({
  createUserId: () => 'split-id-001',
}));

vi.mock('@/infrastructure/iyzico/approve-payment-item', () => ({
  approveIyzicoPaymentItem: (...args: unknown[]) => mockApproveIyzicoPaymentItem(...args),
}));

vi.mock('@/domain/sellers/wallet/release-available-from-split', () => ({
  releaseSellerAvailableFromSplit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/shared/outbox/ops-alert', () => ({
  enqueueOpsAlert: vi.fn().mockResolvedValue(undefined),
}));

vi.stubEnv('PLATFORM_COMMISSION_RATE', '0.10');

import { buildPaymentSplitsForOrder, approvePaymentSplitsForOrder } from '@/domain/payment/payment-split';
import { CommerceError } from '@/shared/errors/commerce-error';

const orderId = '8c9e6679-7425-40de-944b-e07fc1f90ae8';
const sellerId = '660e8400-e29b-41d4-a716-446655440000';

const orderItem = {
  productId: 'prod-1',
  sellerId,
  name: 'Test Ürün',
  price: 100,
  quantity: 2,
  subtotal: 200,
};

describe('buildPaymentSplitsForOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertPaymentSplit.mockResolvedValue({});
    mockFindUsersByIdsLean.mockResolvedValue([
      {
        _id: sellerId,
        role: 'seller',
        isActive: true,
      },
    ]);
  });

  it('onaylı ve iyzico key’li satıcı için split üretir', async () => {
    mockFindSellersByIdsLean.mockResolvedValue([
      {
        _id: sellerId,
        approvalStatus: 'approved',
        iyzicoSubMerchantKey: 'sub-merchant-key',
      },
    ]);

    const result = await buildPaymentSplitsForOrder(orderId, [orderItem]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      productId: 'prod-1',
      sellerId,
      subtotal: 200,
      commissionAmount: 20,
      sellerShare: 180,
      checkoutItem: {
        productId: 'prod-1',
        subMerchantKey: 'sub-merchant-key',
        subMerchantPrice: 180,
      },
    });
    expect(mockUpsertPaymentSplit).toHaveBeenCalledOnce();
  });

  it('onaylı olmayan satıcı için CommerceError fırlatır', async () => {
    mockFindSellersByIdsLean.mockResolvedValue([
      {
        _id: sellerId,
        approvalStatus: 'pending',
        iyzicoSubMerchantKey: 'sub-merchant-key',
      },
    ]);

    await expect(buildPaymentSplitsForOrder(orderId, [orderItem])).rejects.toThrow(CommerceError);
    await expect(buildPaymentSplitsForOrder(orderId, [orderItem])).rejects.toThrow(
      /onaylı olmayan satıcı/
    );
  });

  it('iyzico sub-merchant key yoksa CommerceError fırlatır', async () => {
    mockFindSellersByIdsLean.mockResolvedValue([
      {
        _id: sellerId,
        approvalStatus: 'approved',
        iyzicoSubMerchantKey: null,
      },
    ]);

    await expect(buildPaymentSplitsForOrder(orderId, [orderItem])).rejects.toThrow(
      /alt üye kaydı/
    );
  });
});

describe('approvePaymentSplitsForOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pending split’leri onaylar', async () => {
    const split = {
      paymentTransactionId: 'tx-1',
      approvalStatus: 'pending',
      save: vi.fn().mockResolvedValue(undefined),
    };

    mockFindPendingPaymentSplitsForOrder.mockResolvedValue([split]);
    mockApproveIyzicoPaymentItem.mockResolvedValue(undefined);

    await approvePaymentSplitsForOrder(orderId);

    expect(mockApproveIyzicoPaymentItem).toHaveBeenCalledWith('tx-1', orderId);
    expect(split.approvalStatus).toBe('approved');
    expect(split.save).toHaveBeenCalledOnce();
  });

  it('iyzico onay hatasında split failed olur ve hatayı yükseltir', async () => {
    const split = {
      _id: 'split-id-001',
      sellerId,
      paymentTransactionId: 'tx-1',
      approvalStatus: 'pending',
      save: vi.fn().mockResolvedValue(undefined),
    };

    mockFindPendingPaymentSplitsForOrder.mockResolvedValue([split]);
    mockApproveIyzicoPaymentItem.mockRejectedValue(new Error('iyzico down'));

    await expect(approvePaymentSplitsForOrder(orderId)).rejects.toThrow('iyzico down');
    expect(split.approvalStatus).toBe('failed');
    expect(split.save).toHaveBeenCalledOnce();
  });
});
