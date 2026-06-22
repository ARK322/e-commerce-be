import { CommerceError } from '@/shared/errors/commerce-error';
import { assertCartItemQuantity } from '@/domain/catalog/product/product-order-quantity';
import { findUsersByIdsLean } from '@/repositories/auth/user.repository';
import { findSellersByIdsLean } from '@/repositories/sellers/seller.repository';

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
  const [sellers, users] = await Promise.all([
    findSellersByIdsLean(sellerIds, '_id iyzicoSubMerchantKey approvalStatus'),
    findUsersByIdsLean(sellerIds, '_id isActive role'),
  ]);

  const sellersById = new Map(sellers.map((seller) => [String(seller._id), seller]));
  const usersById = new Map(users.map((user) => [String(user._id), user]));

  for (const item of items) {
    const seller = sellersById.get(item.sellerId);
    const user = usersById.get(item.sellerId);

    if (!seller || seller.approvalStatus !== 'approved') {
      throw new CommerceError(400, 'Sepette onaylı olmayan satıcı ürünü var');
    }

    if (!user || user.role !== 'seller' || user.isActive !== true) {
      throw new CommerceError(400, 'Sepette aktif olmayan satıcı ürünü var');
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
