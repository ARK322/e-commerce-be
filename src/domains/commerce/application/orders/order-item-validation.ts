import { CommerceError } from '@/shared/errors/commerce-error';
import { assertCartItemQuantity } from '@/domains/catalog/application/product/product-order-quantity';
import { findSellersByIdsLean } from '@/domains/identity/infrastructure/repositories/seller.repository';

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
  const sellers = await findSellersByIdsLean(sellerIds, '_id iyzicoSubMerchantKey approvalStatus');

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

export const resolveOrderUnitPrice = (
  _priceSnapshot: number | null | undefined,
  productPrice: number
): number => productPrice;
