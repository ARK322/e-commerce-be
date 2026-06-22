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

const isJpegBuffer = (buffer: Buffer) => buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8;

const isPngBuffer = (buffer: Buffer) =>
  buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

const isWebpBuffer = (buffer: Buffer) =>
  buffer.length >= 12 &&
  buffer.subarray(0, 4).equals(Buffer.from('RIFF')) &&
  buffer.subarray(8, 12).equals(Buffer.from('WEBP'));

const detectImageMimeType = (buffer: Buffer): (typeof PRODUCT_IMAGE_MIMES)[number] | null => {
  if (isJpegBuffer(buffer)) {
    return 'image/jpeg';
  }

  if (isPngBuffer(buffer)) {
    return 'image/png';
  }

  if (isWebpBuffer(buffer)) {
    return 'image/webp';
  }

  return null;
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
  const detected = detectImageMimeType(buffer);

  if (!detected) {
    return null;
  }

  if (mimeType === 'application/octet-stream' || (PRODUCT_IMAGE_MIMES as readonly string[]).includes(mimeType)) {
    return detected;
  }

  return null;
};
