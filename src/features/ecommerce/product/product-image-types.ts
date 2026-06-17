export const MAX_PRODUCT_IMAGES = 10;
export const MAX_PRODUCT_IMAGE_BYTES = 2 * 1024 * 1024;
export const PRODUCT_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type ProductImageUpload = {
  mimeType: string;
  buffer: Buffer;
};

export const buildProductImageObjectPath = (
  sellerId: string,
  productId: string,
  imageId: string,
  extension: string
) => `${sellerId}/products/${productId}/${imageId}.${extension}`;

const isImageBuffer = (buffer: Buffer) => {
  if (buffer.length < 4) {
    return false;
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return true;
  }

  if (buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
    return true;
  }

  return (
    buffer.subarray(0, 4).equals(Buffer.from('RIFF')) &&
    buffer.subarray(8, 12).equals(Buffer.from('WEBP'))
  );
};

export const resolveProductImageExtension = (mimeType: string) => {
  if (mimeType === 'image/png') {
    return 'png';
  }

  if (mimeType === 'image/webp') {
    return 'webp';
  }

  return 'jpg';
};

export const resolveProductImageMimeType = (
  mimeType: string,
  buffer: Buffer
): string | null => {
  if ((PRODUCT_IMAGE_MIMES as readonly string[]).includes(mimeType)) {
    return mimeType;
  }

  if (mimeType !== 'application/octet-stream' || !isImageBuffer(buffer)) {
    return null;
  }

  if (buffer[0] === 0xff) {
    return 'image/jpeg';
  }

  if (buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
    return 'image/png';
  }

  return 'image/webp';
};
