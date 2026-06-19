import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSellerFind = vi.fn();
const mockPaymentSplitFindOneAndUpdate = vi.fn();
const mockPaymentSplitFind = vi.fn();
const mockApproveIyzicoPaymentItem = vi.fn();

vi.mock('@/integrations/mongo', () => ({
  Seller: {
    find: (...args: unknown[]) => mockSellerFind(...args),
  },
  PaymentSplit: {
    findOneAndUpdate: (...args: unknown[]) => mockPaymentSplitFindOneAndUpdate(...args),
    find: (...args: unknown[]) => mockPaymentSplitFind(...args),
  },
}));

vi.mock('@/internal/ids', () => ({
  createUserId: () => 'split-id-001',
}));

vi.mock('@/integrations/iyzico/approve-payment-item', () => ({
  approveIyzicoPaymentItem: (...args: unknown[]) => mockApproveIyzicoPaymentItem(...args),
}));

vi.stubEnv('PLATFORM_COMMISSION_RATE', '0.10');

import { buildPaymentSplitsForOrder, approvePaymentSplitsForOrder } from '@/internal/ecommerce/payment/payment-split';
import { EcommerceError } from '@/internal/ecommerce/errors';

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
    mockPaymentSplitFindOneAndUpdate.mockResolvedValue({});
  });

  it('onaylı ve iyzico key’li satıcı için split üretir', async () => {
    mockSellerFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: sellerId,
            approvalStatus: 'approved',
            iyzicoSubMerchantKey: 'sub-merchant-key',
          },
        ]),
      }),
    });

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
    expect(mockPaymentSplitFindOneAndUpdate).toHaveBeenCalledOnce();
  });

  it('onaylı olmayan satıcı için EcommerceError fırlatır', async () => {
    mockSellerFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: sellerId,
            approvalStatus: 'pending',
            iyzicoSubMerchantKey: 'sub-merchant-key',
          },
        ]),
      }),
    });

    await expect(buildPaymentSplitsForOrder(orderId, [orderItem])).rejects.toThrow(EcommerceError);
    await expect(buildPaymentSplitsForOrder(orderId, [orderItem])).rejects.toThrow(
      /onaylı olmayan satıcı/
    );
  });

  it('iyzico sub-merchant key yoksa EcommerceError fırlatır', async () => {
    mockSellerFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: sellerId,
            approvalStatus: 'approved',
            iyzicoSubMerchantKey: null,
          },
        ]),
      }),
    });

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

    mockPaymentSplitFind.mockResolvedValue([split]);
    mockApproveIyzicoPaymentItem.mockResolvedValue(undefined);

    await approvePaymentSplitsForOrder(orderId);

    expect(mockApproveIyzicoPaymentItem).toHaveBeenCalledWith('tx-1', orderId);
    expect(split.approvalStatus).toBe('approved');
    expect(split.save).toHaveBeenCalledOnce();
  });

  it('iyzico onay hatasında split failed olur ve hatayı yükseltir', async () => {
    const split = {
      paymentTransactionId: 'tx-1',
      approvalStatus: 'pending',
      save: vi.fn().mockResolvedValue(undefined),
    };

    mockPaymentSplitFind.mockResolvedValue([split]);
    mockApproveIyzicoPaymentItem.mockRejectedValue(new Error('iyzico down'));

    await expect(approvePaymentSplitsForOrder(orderId)).rejects.toThrow('iyzico down');
    expect(split.approvalStatus).toBe('failed');
    expect(split.save).toHaveBeenCalledOnce();
  });
});
