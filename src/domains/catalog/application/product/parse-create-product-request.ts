import type { FastifyRequest } from 'fastify';
import type { ZodSchema } from 'zod';
import { HttpError } from '@/shared/errors';
import { sanitizeRequestBody } from '@/shared/validation/sanitize';
import {
  MAX_PRODUCT_IMAGES,
  type ProductImageUpload,
} from '@/domains/catalog/application/product/product-image-types';

const IMAGE_FIELD_NAMES = new Set(['image', 'images']);

const parseCreateProductInput = <T>(raw: unknown, schema: ZodSchema<T>): T => {
  const parsed = schema.safeParse(sanitizeRequestBody(raw));

  if (!parsed.success) {
    throw new HttpError(400, 'Geçersiz istek verisi');
  }

  return parsed.data;
};

export const parseCreateProductRequest = async <T>(
  request: FastifyRequest,
  schema: ZodSchema<T>
): Promise<{ input: T; images: ProductImageUpload[] }> => {
  if (!request.isMultipart()) {
    return {
      input: parseCreateProductInput(request.body, schema),
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
    input: parseCreateProductInput(rawData, schema),
    images,
  };
};
