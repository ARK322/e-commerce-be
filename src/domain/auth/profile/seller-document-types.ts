export const SELLER_DOCUMENT_TYPES = ['taxCertificate', 'signatureCircular', 'companyLogo'] as const;

export type SellerDocumentType = (typeof SELLER_DOCUMENT_TYPES)[number];

export const SELLER_DOCUMENT_FIELD_MAP: Record<SellerDocumentType, string> = {
  taxCertificate: 'taxCertificateUrl',
  signatureCircular: 'signatureCircularUrl',
  companyLogo: 'companyLogoUrl',
};

const PDF_MIME = 'application/pdf';
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const SELLER_DOCUMENT_RULES: Record<
  SellerDocumentType,
  { mimes: readonly string[]; maxBytes: number; extension: string }
> = {
  taxCertificate: { mimes: [PDF_MIME], maxBytes: 5 * 1024 * 1024, extension: 'pdf' },
  signatureCircular: { mimes: [PDF_MIME], maxBytes: 5 * 1024 * 1024, extension: 'pdf' },
  companyLogo: { mimes: IMAGE_MIMES, maxBytes: 2 * 1024 * 1024, extension: 'jpg' },
};

export const isSellerDocumentType = (value: string): value is SellerDocumentType =>
  (SELLER_DOCUMENT_TYPES as readonly string[]).includes(value);

export const buildSellerDocumentObjectPath = (
  userId: string,
  docType: SellerDocumentType,
  extension: string
) => `${userId}/${docType}.${extension}`;

export const resolveDocumentExtension = (mimeType: string, docType: SellerDocumentType) => {
  if (mimeType === 'image/png') {
    return 'png';
  }

  if (mimeType === 'image/webp') {
    return 'webp';
  }

  return SELLER_DOCUMENT_RULES[docType].extension;
};

const PDF_MAGIC = Buffer.from('%PDF');

const isPdfBuffer = (buffer: Buffer) => buffer.subarray(0, 4).equals(PDF_MAGIC);

const isImageBuffer = (buffer: Buffer) => {
  if (buffer.length < 4) {
    return false;
  }

  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return true;
  }

  // PNG
  if (buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
    return true;
  }

  // WEBP (RIFF....WEBP)
  return (
    buffer.subarray(0, 4).equals(Buffer.from('RIFF')) &&
    buffer.subarray(8, 12).equals(Buffer.from('WEBP'))
  );
};

/** Tarayıcı bazen application/octet-stream gönderir; içerik imzasıyla doğrula. */
export const resolveAcceptedMimeType = (
  docType: SellerDocumentType,
  mimeType: string,
  buffer: Buffer
): string | null => {
  const rules = SELLER_DOCUMENT_RULES[docType];

  if (rules.mimes.includes(mimeType)) {
    return mimeType;
  }

  if (mimeType === 'application/octet-stream') {
    if (docType === 'companyLogo' && isImageBuffer(buffer)) {
      if (buffer[0] === 0xff) {
        return 'image/jpeg';
      }

      if (buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
        return 'image/png';
      }

      return 'image/webp';
    }

    if (docType !== 'companyLogo' && isPdfBuffer(buffer)) {
      return 'application/pdf';
    }
  }

  return null;
};
