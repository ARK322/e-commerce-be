import { CommerceError } from '@/shared/errors/commerce-error';
import {
  buildProductImageObjectPath,
  MAX_PRODUCT_IMAGE_BYTES,
  MAX_PRODUCT_IMAGES,
  resolveProductImageExtension,
  resolveProductImageMimeType,
} from '@/domains/catalog/application/product/product-image-types';
import { toSellerProductResponse } from '@/domains/catalog/application/product/product-response';
import { invalidateCatalogProductCache } from '@/domains/catalog/infrastructure/cache/catalog-cache';
import { createUserId } from '@/shared/ids';
import {
  deleteFromSellerStorage,
  getSupabaseConfig,
  parseStorageObjectPathFromPublicUrl,
  uploadToSellerStorage,
} from '@/integrations/supabase/supabase';
import {
  findOwnedProductById,
  pushProductImageIfUnderLimit,
  saveProductDocument,
} from '@/domains/catalog/infrastructure/repositories/product.repository';

const getOwnedProduct = async (sellerId: string, productId: string) => {
  const product = await findOwnedProductById(sellerId, productId);

  if (!product) {
    throw new CommerceError(404, 'Ürün bulunamadı');
  }

  return product;
};

const removeStoredImageIfManaged = async (sellerId: string, url: string) => {
  const { bucket } = getSupabaseConfig();
  const objectPath = parseStorageObjectPathFromPublicUrl(url, bucket);

  if (!objectPath) {
    return;
  }

  if (!objectPath.startsWith(`${sellerId}/`)) {
    throw new CommerceError(403, 'Görsel silme yetkisi yok');
  }

  await deleteFromSellerStorage(objectPath);
};

export const deleteProductImagesFromStorage = async (sellerId: string, imageUrls: string[]) => {
  await Promise.all(imageUrls.map((url) => removeStoredImageIfManaged(sellerId, url)));
};

export const uploadProductImage = async (
  sellerId: string,
  productId: string,
  mimeType: string,
  buffer: Buffer
) => {
  if (buffer.length === 0) {
    throw new CommerceError(400, 'Dosya boş olamaz');
  }

  if (buffer.length > MAX_PRODUCT_IMAGE_BYTES) {
    throw new CommerceError(400, 'Dosya boyutu limiti aşıldı');
  }

  const resolvedMimeType = resolveProductImageMimeType(mimeType, buffer);

  if (!resolvedMimeType) {
    throw new CommerceError(400, 'Geçersiz dosya türü');
  }

  const ownedProduct = await getOwnedProduct(sellerId, productId);

  if (ownedProduct.images.length >= MAX_PRODUCT_IMAGES) {
    throw new CommerceError(400, `En fazla ${MAX_PRODUCT_IMAGES} görsel eklenebilir`);
  }

  const imageId = createUserId();
  const extension = resolveProductImageExtension(resolvedMimeType);
  const objectPath = buildProductImageObjectPath(sellerId, productId, imageId, extension);
  const url = await uploadToSellerStorage(objectPath, buffer, resolvedMimeType);

  const product = await pushProductImageIfUnderLimit(
    sellerId,
    productId,
    url,
    MAX_PRODUCT_IMAGES
  );

  if (!product) {
    await deleteFromSellerStorage(objectPath);
    throw new CommerceError(400, `En fazla ${MAX_PRODUCT_IMAGES} görsel eklenebilir`);
  }

  await invalidateCatalogProductCache();

  return {
    url,
    product: toSellerProductResponse(product.toObject()),
  };
};

export const deleteProductImage = async (
  sellerId: string,
  productId: string,
  imageUrl: string
) => {
  const product = await getOwnedProduct(sellerId, productId);

  if (!product.images.includes(imageUrl)) {
    throw new CommerceError(404, 'Ürün görseli bulunamadı');
  }

  await removeStoredImageIfManaged(sellerId, imageUrl);

  product.images = product.images.filter((url) => url !== imageUrl);
  product.updatedAt = new Date();
  await saveProductDocument(product);

  await invalidateCatalogProductCache();

  return {
    url: imageUrl,
    product: toSellerProductResponse(product.toObject()),
  };
};
