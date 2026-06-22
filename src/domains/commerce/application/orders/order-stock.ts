import mongoose from 'mongoose';
import { CommerceError } from '@/shared/errors/commerce-error';
import { invalidateCatalogProductStock } from '@/domains/catalog/infrastructure/cache/catalog-cache';
import {
  decrementProductStockIfAvailable,
  incrementProductStock,
} from '@/domains/catalog/infrastructure/repositories/product.repository';

export type StockDecrement = {
  productId: string;
  quantity: number;
};

export const decrementStockForOrderItems = async (
  items: StockDecrement[],
  session?: mongoose.ClientSession
): Promise<void> => {
  for (const item of items) {
    const updated = await decrementProductStockIfAvailable(
      item.productId,
      item.quantity,
      session
    );

    if (!updated) {
      throw new CommerceError(400, 'Yetersiz stok');
    }
  }

  await invalidateCatalogProductStock(items.map((item) => item.productId));
};

export const incrementStockForOrderItems = async (
  items: StockDecrement[],
  session?: mongoose.ClientSession
): Promise<void> => {
  for (const item of items) {
    await incrementProductStock(item.productId, item.quantity, session);
  }

  await invalidateCatalogProductStock(items.map((item) => item.productId));
};
