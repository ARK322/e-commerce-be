import { Seller } from '@/integrations/mongo';
import { CommerceError } from '@/internal/common/errors/commerce-error';
import { assertCartItemQuantity } from '@/internal/catalog/product/product-order-quantity';

export const assertProductStockAvailable = (
  product: { stock: number; minOrderQuantity?: number | null },
  quantity: number
) => {
  assertCartItemQuantity(quantity, product);

  if (quantity > product.stock) {
    throw new CommerceError(400, 'Yetersiz stok');
  }
};

export const assertSellersReadyForOrder = async (
  items: Array<{ sellerId: string }>
): Promise<void> => {
  const sellerIds = [...new Set(items.map((item) => item.sellerId))];
  const sellers = await Seller.find({ _id: { $in: sellerIds } })
    .select('_id iyzicoSubMerchantKey approvalStatus')
    .lean();

  const sellersById = new Map(sellers.map((seller) => [String(seller._id), seller]));

  for (const item of items) {
    const seller = sellersById.get(item.sellerId);

    if (!seller || seller.approvalStatus !== 'approved') {
      throw new CommerceError(400, 'Sepette onaylı olmayan satıcı ürünü var');
    }

    if (!seller.iyzicoSubMerchantKey) {
      throw new CommerceError(
        400,
        'Satıcı ödeme alt üye kaydı tamamlanmamış; sipariş oluşturulamaz'
      );
    }
  }
};

const PRICE_SNAPSHOT_TOLERANCE_RATIO = 0.01;

export const resolveOrderUnitPrice = (
  priceSnapshot: number | null | undefined,
  productPrice: number
): number => {
  if (priceSnapshot == null || !Number.isFinite(priceSnapshot) || priceSnapshot < 0) {
    return productPrice;
  }

  if (priceSnapshot > productPrice) {
    return productPrice;
  }

  if (priceSnapshot === 0 && productPrice > 0) {
    return productPrice;
  }

  const minTrustedSnapshot = productPrice * (1 - PRICE_SNAPSHOT_TOLERANCE_RATIO);

  if (priceSnapshot >= minTrustedSnapshot) {
    return productPrice;
  }

  return priceSnapshot;
};
