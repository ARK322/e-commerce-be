import mongoose from 'mongoose';
import { Product } from '@/integrations/mongo';
import { CommerceError } from '@/internal/common/errors/commerce-error';
import { invalidateCatalogProductStock } from '@/internal/common/cache/catalog-cache';

export type StockDecrement = {
  productId: string;
  quantity: number;
};

export const decrementStockForOrderItems = async (
  items: StockDecrement[],
  session?: mongoose.ClientSession
): Promise<void> => {
  for (const item of items) {
    const updated = await Product.findOneAndUpdate(
      {
        _id: item.productId,
        stock: { $gte: item.quantity },
        isActive: true,
      },
      {
        $inc: { stock: -item.quantity },
        $set: { updatedAt: new Date() },
      },
      { session, new: true }
    );

    if (!updated) {
      throw new CommerceError(400, 'Yetersiz stok');
    }
  }

  invalidateCatalogProductStock(items.map((item) => item.productId));
};
