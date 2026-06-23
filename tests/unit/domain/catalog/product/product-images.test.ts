import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindOwnedProductById = vi.fn();
const mockPushProductImageIfUnderLimit = vi.fn();
const mockUpload = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/repositories/catalog/product.repository', () => ({
  findOwnedProductById: (...args: unknown[]) => mockFindOwnedProductById(...args),
  pushProductImageIfUnderLimit: (...args: unknown[]) => mockPushProductImageIfUnderLimit(...args),
  saveProductDocument: (product: { save: () => Promise<unknown> }) => product.save(),
}));

vi.mock('@/infrastructure/supabase/supabase', () => ({
  uploadToSellerStorage: (...args: unknown[]) => mockUpload(...args),
  deleteFromSellerStorage: (...args: unknown[]) => mockDelete(...args),
  getSupabaseConfig: () => ({ bucket: 'seller-documents' }),
  parseStorageObjectPathFromPublicUrl: (url: string, bucket: string) => {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = url.indexOf(marker);
    return index === -1 ? null : url.slice(index + marker.length);
  },
}));

vi.mock('@/shared/ids', () => ({
  createUserId: () => '880e8400-e29b-41d4-a716-446655440000',
}));

import {
  deleteProductImage,
  uploadProductImage,
} from '@/domain/catalog/product/product-images';

const sellerId = '550e8400-e29b-41d4-a716-446655440000';
const productId = '660e8400-e29b-41d4-a716-446655440001';
const imageUrl = `https://xxx.supabase.co/storage/v1/object/public/seller-documents/${sellerId}/products/${productId}/880e8400-e29b-41d4-a716-446655440000.jpg`;

const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0x00]);

describe('uploadProductImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpload.mockResolvedValue(imageUrl);
  });

  it('ürün bulunamazsa 404 fırlatır', async () => {
    mockFindOwnedProductById.mockResolvedValue(null);

    await expect(
      uploadProductImage(sellerId, productId, 'image/jpeg', jpegBuffer)
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('görsel yükler ve ürüne ekler', async () => {
    mockFindOwnedProductById.mockResolvedValue({
      sellerId,
      images: [],
      updatedAt: new Date(),
    });
    mockPushProductImageIfUnderLimit.mockResolvedValue({
      sellerId,
      images: [imageUrl],
      toObject: () => ({
        _id: productId,
        sellerId,
        categoryId: 'cat',
        name: 'Test',
        price: 10,
        currency: 'TRY',
        stock: 1,
        isActive: true,
        images: [imageUrl],
      }),
    });

    const result = await uploadProductImage(sellerId, productId, 'image/jpeg', jpegBuffer);

    expect(mockUpload).toHaveBeenCalledWith(
      `${sellerId}/products/${productId}/880e8400-e29b-41d4-a716-446655440000.jpg`,
      jpegBuffer,
      'image/jpeg'
    );
    expect(mockPushProductImageIfUnderLimit).toHaveBeenCalled();
    expect(result.url).toBe(imageUrl);
    expect(result.product.images).toEqual([imageUrl]);
  });

  it('10 görsel limitini aşamaz', async () => {
    mockFindOwnedProductById.mockResolvedValue({
      sellerId,
      images: Array.from({ length: 10 }, (_, index) => `https://example.com/${index}.jpg`),
    });

    await expect(
      uploadProductImage(sellerId, productId, 'image/jpeg', jpegBuffer)
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'En fazla 10 görsel eklenebilir',
    });
  });
});

describe('deleteProductImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('görseli siler', async () => {
    const save = vi.fn();
    mockFindOwnedProductById.mockResolvedValue({
      sellerId,
      images: [imageUrl],
      updatedAt: new Date(),
      save,
      toObject: () => ({
        _id: productId,
        sellerId,
        categoryId: 'cat',
        name: 'Test',
        price: 10,
        currency: 'TRY',
        stock: 1,
        isActive: true,
        images: [],
      }),
    });

    const result = await deleteProductImage(sellerId, productId, imageUrl);

    expect(mockDelete).toHaveBeenCalledWith(
      `${sellerId}/products/${productId}/880e8400-e29b-41d4-a716-446655440000.jpg`
    );
    expect(save).toHaveBeenCalled();
    expect(result.product.images).toEqual([]);
  });
});
