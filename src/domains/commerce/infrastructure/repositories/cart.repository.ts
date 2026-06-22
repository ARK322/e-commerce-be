import type { ClientSession } from 'mongoose';
import { Cart } from '@/integrations/mongo';

export const findCartByBuyerId = async (buyerId: string) => Cart.findById(buyerId);

export const ensureCartDocument = async (buyerId: string) => {
  const existing = await findCartByBuyerId(buyerId);

  if (existing) {
    return existing;
  }

  return Cart.create({ _id: buyerId, items: [] });
};

export const saveCartDocumentItems = async (
  cart: { items: unknown[]; updatedAt?: Date; save: () => Promise<unknown> },
  items: unknown[]
) => {
  cart.items = items;
  cart.updatedAt = new Date();
  await cart.save();
};

export const clearBuyerCartItems = async (buyerId: string) => {
  const cart = await ensureCartDocument(buyerId);
  await saveCartDocumentItems(cart, []);
  return cart;
};

export const clearNonEmptyCartInSession = async (buyerId: string, session: ClientSession) =>
  Cart.findOneAndUpdate(
    { _id: buyerId, 'items.0': { $exists: true } },
    { $set: { items: [], updatedAt: new Date() } },
    { session, returnDocument: 'before' }
  );

export type CartItemSnapshot = {
  productId: string;
  quantity: number;
  priceSnapshot?: number | null;
};

export const restoreCartItemsForBuyer = async (
  buyerId: string,
  items: CartItemSnapshot[]
): Promise<void> => {
  const cart = await ensureCartDocument(buyerId);
  await saveCartDocumentItems(cart, items);
};
