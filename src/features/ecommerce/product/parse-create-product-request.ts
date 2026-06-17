import type { FastifyRequest } from 'fastify';
import { HttpError } from '@/lib/common/errors';
import { sanitizeRequestBody } from '@/lib/common/validation/sanitize';
import {
  createProductSchema,
  type CreateProductInput,
} from '@/features/ecommerce/product/create-product.schema';
import {
  MAX_PRODUCT_IMAGES,
  type ProductImageUpload,
} from '@/features/ecommerce/product/product-image-types';

export type ParsedCreateProductRequest = {
  input: CreateProductInput;
  images: ProductImageUpload[];
};

const IMAGE_FIELD_NAMES = new Set(['image', 'images']);

const parseCreateProductInput = (raw: unknown): CreateProductInput => {
  const parsed = createProductSchema.safeParse(sanitizeRequestBody(raw));

  if (!parsed.success) {
    throw new HttpError(400, 'Geçersiz istek verisi');
  }

  return parsed.data;
};

export const parseCreateProductRequest = async (
  request: FastifyRequest
): Promise<ParsedCreateProductRequest> => {
  if (!request.isMultipart()) {
    return {
      input: parseCreateProductInput(request.body),
      images: [],
    };
  }

  let rawData: unknown = null;
  const images: ProductImageUpload[] = [];

  for await (const part of request.parts()) {
    if (part.type === 'field') {
      if (part.fieldname === 'data') {
        try {
          rawData = JSON.parse(String(part.value));
        } catch {
          throw new HttpError(400, 'data alanı geçerli JSON olmalı');
        }
      }
      continue;
    }

    if (part.type === 'file' && IMAGE_FIELD_NAMES.has(part.fieldname)) {
      images.push({
        mimeType: part.mimetype,
        buffer: await part.toBuffer(),
      });
    }
  }

  if (rawData === null) {
    throw new HttpError(400, 'data alanı zorunlu');
  }

  if (images.length > MAX_PRODUCT_IMAGES) {
    throw new HttpError(400, `En fazla ${MAX_PRODUCT_IMAGES} görsel eklenebilir`);
  }

  return {
    input: parseCreateProductInput(rawData),
    images,
  };
};
