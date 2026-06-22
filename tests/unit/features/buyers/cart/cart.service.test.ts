import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCartFindById = vi.fn();
const mockCartCreate = vi.fn();
const mockProductFind = vi.fn();
const mockAssertPurchasableCatalogProduct = vi.fn();

vi.mock('@/infrastructure/mongo', () => ({
  Cart: {
    findById: (...args: unknown[]) => mockCartFindById(...args),
    create: (...args: unknown[]) => mockCartCreate(...args),
  },
  Product: {
    find: (...args: unknown[]) => mockProductFind(...args),
  },
}));

vi.mock('@/domain/catalog/product/assert-purchasable-product', () => ({
  assertPurchasableCatalogProduct: (...args: unknown[]) =>
    mockAssertPurchasableCatalogProduct(...args),
}));

import {
  addToCart,
  clearCart,
  removeCartItem,
  updateCartItem,
} from '@/features/buyers/cart/cart.service';

const buyerId = '550e8400-e29b-41d4-a716-446655440000';
const productId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

const productDoc = {
  _id: productId,
  name: 'Kulaklık',
  price: 999,
  stock: 5,
  minOrderQuantity: 1,
  isActive: true,
  images: [],
};

const createCartDoc = (items: Array<{ productId: string; quantity: number; priceSnapshot: number }>) => {
  const cart = {
    _id: buyerId,
    items: [...items],
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    save: vi.fn().mockResolvedValue(undefined),
    toObject: () => ({
      _id: buyerId,
      items: cart.items,
      updatedAt: cart.updatedAt,
    }),
  };

  return cart;
};

describe('addToCart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertPurchasableCatalogProduct.mockResolvedValue(productDoc);
    mockProductFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([productDoc]),
      }),
    });
  });

  it('kategorisiz (orphan) ürün sepete eklenemez', async () => {
    const { CommerceError } = await import('@/shared/errors/commerce-error');
    mockAssertPurchasableCatalogProduct.mockRejectedValue(
      new CommerceError(404, 'Ürün bulunamadı')
    );
    mockCartFindById.mockResolvedValue(createCartDoc([]));

    await expect(
      addToCart(buyerId, { productId, quantity: 1 })
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Ürün bulunamadı',
    });

    expect(mockAssertPurchasableCatalogProduct).toHaveBeenCalledWith(productId);
  });

  it('aktif ürün yoksa 404 fırlatır', async () => {
    const { CommerceError } = await import('@/shared/errors/commerce-error');
    mockAssertPurchasableCatalogProduct.mockRejectedValue(
      new CommerceError(404, 'Ürün bulunamadı')
    );
    mockCartFindById.mockResolvedValue(createCartDoc([]));

    await expect(
      addToCart(buyerId, { productId, quantity: 1 })
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('stok yetersizse 400 fırlatır', async () => {
    mockCartFindById.mockResolvedValue(createCartDoc([]));

    await expect(
      addToCart(buyerId, { productId, quantity: 10 })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Yetersiz stok',
    });
  });

  it('minimum sipariş adedinin altında 400 fırlatır', async () => {
    mockAssertPurchasableCatalogProduct.mockResolvedValue({ ...productDoc, minOrderQuantity: 3 });
    mockCartFindById.mockResolvedValue(createCartDoc([]));

    await expect(
      addToCart(buyerId, { productId, quantity: 2 })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Minimum sipariş adedi 3',
    });
  });

  it('yeni ürünü sepete ekler', async () => {
    const cart = createCartDoc([]);
    mockCartFindById.mockResolvedValue(cart);

    const result = await addToCart(buyerId, { productId, quantity: 2 });

    expect(cart.save).toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      productId,
      quantity: 2,
      priceSnapshot: 999,
    });
  });

  it('mevcut ürünün adedini artırır', async () => {
    const cart = createCartDoc([{ productId, quantity: 2, priceSnapshot: 900 }]);
    mockCartFindById.mockResolvedValue(cart);

    const result = await addToCart(buyerId, { productId, quantity: 1 });

    expect(result.items[0].quantity).toBe(3);
    expect(result.items[0].priceSnapshot).toBe(999);
  });
});

describe('updateCartItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertPurchasableCatalogProduct.mockResolvedValue(productDoc);
    mockProductFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([productDoc]),
      }),
    });
  });

  it('sepette olmayan ürün için 404 fırlatır', async () => {
    mockCartFindById.mockResolvedValue(createCartDoc([]));

    await expect(updateCartItem(buyerId, productId, 1)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('removeCartItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProductFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  it('ürünü sepetten kaldırır', async () => {
    const cart = createCartDoc([{ productId, quantity: 1, priceSnapshot: 999 }]);
    mockCartFindById.mockResolvedValue(cart);

    const result = await removeCartItem(buyerId, productId);

    expect(result.items).toHaveLength(0);
  });
});

describe('clearCart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sepeti boşaltır', async () => {
    const cart = createCartDoc([{ productId, quantity: 1, priceSnapshot: 999 }]);
    mockCartFindById.mockResolvedValue(cart);

    const result = await clearCart(buyerId);

    expect(cart.save).toHaveBeenCalled();
    expect(result.items).toHaveLength(0);
  });
});
