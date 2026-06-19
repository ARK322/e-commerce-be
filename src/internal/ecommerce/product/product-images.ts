import { Product } from '@/integrations/mongo';
import { EcommerceError } from '@/internal/ecommerce/errors';
import {
  buildProductImageObjectPath,
  MAX_PRODUCT_IMAGE_BYTES,
  MAX_PRODUCT_IMAGES,
  resolveProductImageExtension,
  resolveProductImageMimeType,
} from '@/internal/ecommerce/product/product-image-types';
import { toSellerProductResponse } from '@/internal/ecommerce/product/product-response';
import { createUserId } from '@/internal/ids';
import {
  deleteFromSellerStorage,
  getSupabaseConfig,
  parseStorageObjectPathFromPublicUrl,
  uploadToSellerStorage,
} from '@/integrations/supabase/supabase';

const getOwnedProduct = async (sellerId: string, productId: string) => {
  const product = await Product.findById(productId);

  if (!product || product.sellerId !== sellerId) {
    throw new EcommerceError(404, 'Ürün bulunamadı');
  }

  return product;
};

const removeStoredImageIfManaged = async (url: string) => {
  const { bucket } = getSupabaseConfig();
  const objectPath = parseStorageObjectPathFromPublicUrl(url, bucket);

  if (objectPath) {
    await deleteFromSellerStorage(objectPath);
  }
};

export const deleteProductImagesFromStorage = async (imageUrls: string[]) => {
  await Promise.all(imageUrls.map((url) => removeStoredImageIfManaged(url)));
};

export const uploadProductImage = async (
  sellerId: string,
  productId: string,
  mimeType: string,
  buffer: Buffer
) => {
  if (buffer.length === 0) {
    throw new EcommerceError(400, 'Dosya boş olamaz');
  }

  if (buffer.length > MAX_PRODUCT_IMAGE_BYTES) {
    throw new EcommerceError(400, 'Dosya boyutu limiti aşıldı');
  }

  const resolvedMimeType = resolveProductImageMimeType(mimeType, buffer);

  if (!resolvedMimeType) {
    throw new EcommerceError(400, 'Geçersiz dosya türü');
  }

  const product = await getOwnedProduct(sellerId, productId);

  if (product.images.length >= MAX_PRODUCT_IMAGES) {
    throw new EcommerceError(400, `En fazla ${MAX_PRODUCT_IMAGES} görsel eklenebilir`);
  }

  const imageId = createUserId();
  const extension = resolveProductImageExtension(resolvedMimeType);
  const objectPath = buildProductImageObjectPath(sellerId, productId, imageId, extension);
  const url = await uploadToSellerStorage(objectPath, buffer, resolvedMimeType);

  product.images = [...product.images, url];
  product.updatedAt = new Date();
  await product.save();

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
    throw new EcommerceError(404, 'Ürün görseli bulunamadı');
  }

  await removeStoredImageIfManaged(imageUrl);

  product.images = product.images.filter((url) => url !== imageUrl);
  product.updatedAt = new Date();
  await product.save();

  return {
    url: imageUrl,
    product: toSellerProductResponse(product.toObject()),
  };
};
