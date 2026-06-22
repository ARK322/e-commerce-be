import { CommerceError } from '@/shared/errors/commerce-error';

export const resolveMinOrderQuantity = (minOrderQuantity?: number | null) =>
  minOrderQuantity ?? 1;

export const assertCartItemQuantity = (
  quantity: number,
  product: { stock: number; minOrderQuantity?: number | null }
) => {
  const minOrderQuantity = resolveMinOrderQuantity(product.minOrderQuantity);

  if (quantity < minOrderQuantity) {
    throw new CommerceError(400, `Minimum sipariş adedi ${minOrderQuantity}`);
  }

  if (quantity > product.stock) {
    throw new CommerceError(400, 'Yetersiz stok');
  }
};
