import { CommerceError } from '@/shared/errors/commerce-error';
import type { AddToCartInput } from '@/api/buyer/cart/add-to-cart.schema';
import {
  assertCartItemQuantity,
  resolveMinOrderQuantity,
} from '@/domains/catalog/application/product/product-order-quantity';
import {
  findPurchasableCatalogProductLean,
} from '@/domains/catalog/application/product/assert-purchasable-product';
import {
  clearBuyerCartItems,
  ensureCartDocument,
  saveCartDocumentItems,
} from '@/domains/commerce/infrastructure/repositories/cart.repository';
import { assertPurchasableCatalogProduct } from '@/domains/catalog/application/product/assert-purchasable-product';

type CartItemRecord = {
  productId: string;
  quantity: number;
  priceSnapshot?: number | null;
};

type PurchasableProduct = Awaited<ReturnType<typeof assertPurchasableCatalogProduct>>;

const enrichCartItemFromProduct = (item: CartItemRecord, product: PurchasableProduct) => {
  const priceChanged =
    item.priceSnapshot != null && Math.abs(item.priceSnapshot - product.price) > 0.001;

  return {
    productId: item.productId,
    quantity: item.quantity,
    priceSnapshot: item.priceSnapshot ?? null,
    currentPrice: product.price,
    priceChanged,
    isPurchasable: true,
    product: {
      name: product.name,
      price: product.price,
      stock: product.stock,
      minOrderQuantity: resolveMinOrderQuantity(product.minOrderQuantity),
      isActive: product.isActive,
      images: product.images,
    },
    isAvailable:
      product.stock >= item.quantity &&
      item.quantity >= resolveMinOrderQuantity(product.minOrderQuantity),
  };
};

const enrichCartItem = async (item: CartItemRecord) => {
  const product = await findPurchasableCatalogProductLean(item.productId);

  if (!product) {
    return {
      productId: item.productId,
      quantity: item.quantity,
      priceSnapshot: item.priceSnapshot ?? null,
      currentPrice: null,
      priceChanged: false,
      isPurchasable: false,
      product: null,
      isAvailable: false,
    };
  }

  return enrichCartItemFromProduct(item, product);
};

const buildCartResponse = async (cart: {
  _id: unknown;
  items: CartItemRecord[];
  updatedAt?: Date;
}) => ({
  id: String(cart._id),
  items: await Promise.all(cart.items.map((item) => enrichCartItem(item))),
  updatedAt: cart.updatedAt,
});

const getActiveProduct = async (productId: string) => assertPurchasableCatalogProduct(productId);

const ensureCart = ensureCartDocument;

const saveCartItems = saveCartDocumentItems;

export const getCart = async (buyerId: string) => {
  const cart = await ensureCart(buyerId);

  return buildCartResponse(cart.toObject());
};

export const addToCart = async (buyerId: string, input: AddToCartInput) => {
  const product = await getActiveProduct(input.productId);
  const cart = await ensureCart(buyerId);

  const items = cart.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    priceSnapshot: item.priceSnapshot,
  }));

  const existingIndex = items.findIndex((item) => item.productId === input.productId);
  const nextQuantity =
    existingIndex >= 0 ? items[existingIndex].quantity + input.quantity : input.quantity;

  assertCartItemQuantity(nextQuantity, product);

  const nextItem = {
    productId: input.productId,
    quantity: nextQuantity,
    priceSnapshot: product.price,
  };

  if (existingIndex >= 0) {
    items[existingIndex] = nextItem;
  } else {
    items.push(nextItem);
  }

  await saveCartItems(cart, items);

  const itemsWithProduct = await Promise.all(
    items.map(async (item) => {
      if (item.productId === input.productId) {
        return enrichCartItemFromProduct(item, product);
      }

      return enrichCartItem(item);
    })
  );

  return {
    id: String(cart._id),
    items: itemsWithProduct,
    updatedAt: cart.updatedAt,
  };
};

export const updateCartItem = async (
  buyerId: string,
  productId: string,
  quantity: number
) => {
  const product = await getActiveProduct(productId);
  const cart = await ensureCart(buyerId);

  const items = cart.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    priceSnapshot: item.priceSnapshot,
  }));

  const existingIndex = items.findIndex((item) => item.productId === productId);

  if (existingIndex < 0) {
    throw new CommerceError(404, 'Ürün sepette bulunamadı');
  }

  assertCartItemQuantity(quantity, product);

  items[existingIndex] = {
    productId,
    quantity,
    priceSnapshot: product.price,
  };

  await saveCartItems(cart, items);

  const itemsWithProduct = await Promise.all(
    items.map(async (item) => {
      if (item.productId === productId) {
        return enrichCartItemFromProduct(item, product);
      }

      return enrichCartItem(item);
    })
  );

  return {
    id: String(cart._id),
    items: itemsWithProduct,
    updatedAt: cart.updatedAt,
  };
};

export const removeCartItem = async (buyerId: string, productId: string) => {
  const cart = await ensureCart(buyerId);

  const items = cart.items
    .map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      priceSnapshot: item.priceSnapshot,
    }))
    .filter((item) => item.productId !== productId);

  if (items.length === cart.items.length) {
    throw new CommerceError(404, 'Ürün sepette bulunamadı');
  }

  await saveCartItems(cart, items);

  return buildCartResponse({ ...cart.toObject(), items });
};

export const clearCart = async (buyerId: string) => {
  const cart = await clearBuyerCartItems(buyerId);

  return buildCartResponse({ ...cart.toObject(), items: [] });
};
