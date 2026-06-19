import type { FastifyInstance, FastifyRequest } from 'fastify';
import { HttpError } from '@/internal/errors';
import { sanitizeRequestBody } from '@/internal/validation/sanitize';
import {
  createProductSchema,
  type CreateProductInput,
} from '@/features/ecommerce/product/create-product.schema';
import {
  MAX_PRODUCT_IMAGES,
  type ProductImageUpload,
} from '@/internal/ecommerce/product/product-image-types';
import { registerProductMultipart } from '@/plugins/multipart/product';
import { ECOMMERCE_SELLER_WRITE_RATE_LIMIT } from '@/middleware/presets/rate-limit';
import { registerScopedRateLimit } from '@/plugins/rate-limit/register-scoped';
import { requireAuth } from '@/middleware/auth/require-auth';
import { requireEmailVerified } from '@/middleware/auth/require-email-verified';
import {
  requireApprovedSeller,
  requireSellerPermission,
} from '@/middleware/ecommerce/require-approved-seller';
import { validateBody } from '@/middleware/validation/validate-body';
import { validateParams } from '@/middleware/validation/validate-params';
import { validateQuery } from '@/middleware/validation/validate-query';
import { productIdParamSchema } from '@/internal/validation/param-schemas';
import { handleRouteError } from '@/internal/errors/handle-route-error';
import { SELLER_PERMISSIONS } from '@/internal/auth/access/seller/permission-keys';
import {
  updateProductSchema,
  type UpdateProductInput,
} from '@/features/ecommerce/product/update-product.schema';
import {
  listProductsQuerySchema,
  type ListProductsQuery,
} from '@/features/ecommerce/product/list-products.schema';
import {
  createProductWithImages,
  deleteProduct,
  getPublicProductById,
  listPublicProducts,
  listSellerProducts,
  updateProduct,
} from '@/features/ecommerce/product/product.service';
import {
  deleteProductImage,
  uploadProductImage,
} from '@/internal/ecommerce/product/product-images';
import {
  deleteProductImageSchema,
  type DeleteProductImageInput,
} from '@/features/ecommerce/product/delete-product-image.schema';

const IMAGE_FIELD_NAMES = new Set(['image', 'images']);

const parseCreateProductInput = (raw: unknown): CreateProductInput => {
  const parsed = createProductSchema.safeParse(sanitizeRequestBody(raw));

  if (!parsed.success) {
    throw new HttpError(400, 'Geçersiz istek verisi');
  }

  return parsed.data;
};

const parseCreateProductRequest = async (request: FastifyRequest) => {
  if (!request.isMultipart()) {
    return {
      input: parseCreateProductInput(request.body),
      images: [] as ProductImageUpload[],
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

const sellerApproved = {
  preHandler: [requireAuth, requireEmailVerified, requireApprovedSeller],
};

const sellerRead = {
  preHandler: [
    ...sellerApproved.preHandler,
    requireSellerPermission(SELLER_PERMISSIONS.PRODUCTS_READ),
  ],
};

const sellerWrite = {
  preHandler: [
    ...sellerApproved.preHandler,
    requireSellerPermission(SELLER_PERMISSIONS.PRODUCTS_WRITE),
  ],
};

const sellerWriteWithProductId = {
  preHandler: [
    ...sellerWrite.preHandler,
    validateParams(productIdParamSchema),
  ],
};

export default async function productRoutes(fastify: FastifyInstance) {
  await registerProductMultipart(fastify);

  fastify.get(
    '/',
    { preHandler: [validateQuery(listProductsQuerySchema)] },
    async (req, reply) => {
      try {
        const result = await listPublicProducts(req.query as ListProductsQuery);
        return reply.status(200).send(result);
      } catch (error) {
        return handleRouteError(reply, error, 'Ürünler alınırken bir hata oluştu');
      }
    }
  );

  await fastify.register(async (sellerScope) => {
    await registerScopedRateLimit(sellerScope, ECOMMERCE_SELLER_WRITE_RATE_LIMIT);

    sellerScope.get('/mine', sellerRead, async (req, reply) => {
      try {
        const products = await listSellerProducts(req.sellerContext!.companyId);
        return reply.status(200).send({ products });
      } catch (error) {
        return handleRouteError(reply, error, 'Ürün işlemi sırasında bir hata oluştu');
      }
    });

    sellerScope.post('/', sellerWrite, async (req, reply) => {
      try {
        const { input, images } = await parseCreateProductRequest(req);
        const product = await createProductWithImages(
          req.sellerContext!.companyId,
          input,
          images
        );

        return reply.status(201).send({
          message: images.length > 0 ? 'Ürün ve görseller oluşturuldu' : 'Ürün oluşturuldu',
          product,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Ürün işlemi sırasında bir hata oluştu', {
          duplicateKeyMessage: 'Bu slug zaten kullanılıyor',
        });
      }
    });

    sellerScope.patch(
      '/:productId',
      {
        preHandler: [...sellerWriteWithProductId.preHandler, validateBody(updateProductSchema)],
      },
      async (req, reply) => {
        try {
          const { productId } = req.params as { productId: string };
          const product = await updateProduct(
            req.sellerContext!.companyId,
            productId,
            req.body as UpdateProductInput
          );

          return reply.status(200).send({
            message: 'Ürün güncellendi',
            product,
          });
        } catch (error) {
          return handleRouteError(reply, error, 'Ürün işlemi sırasında bir hata oluştu', {
            duplicateKeyMessage: 'Bu slug zaten kullanılıyor',
          });
        }
      }
    );

    sellerScope.post('/:productId/images', sellerWriteWithProductId, async (req, reply) => {
      try {
        const { productId } = req.params as { productId: string };
        const file = await req.file();

        if (!file) {
          return reply.status(400).send({ message: 'Dosya zorunlu' });
        }

        const buffer = await file.toBuffer();
        const result = await uploadProductImage(
          req.sellerContext!.companyId,
          productId,
          file.mimetype,
          buffer
        );

        return reply.status(201).send({
          message: 'Ürün görseli yüklendi',
          ...result,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Ürün görseli yüklenirken bir hata oluştu');
      }
    });

    sellerScope.delete(
      '/:productId/images',
      {
        preHandler: [
          ...sellerWriteWithProductId.preHandler,
          validateBody(deleteProductImageSchema),
        ],
      },
      async (req, reply) => {
        try {
          const { productId } = req.params as { productId: string };
          const { url } = req.body as DeleteProductImageInput;
          const result = await deleteProductImage(
            req.sellerContext!.companyId,
            productId,
            url
          );

          return reply.status(200).send({
            message: 'Ürün görseli silindi',
            ...result,
          });
        } catch (error) {
          return handleRouteError(reply, error, 'Ürün görseli silinirken bir hata oluştu');
        }
      }
    );

    sellerScope.delete('/:productId', sellerWriteWithProductId, async (req, reply) => {
      try {
        const { productId } = req.params as { productId: string };
        await deleteProduct(req.sellerContext!.companyId, productId);

        return reply.status(200).send({ message: 'Ürün silindi' });
      } catch (error) {
        return handleRouteError(reply, error, 'Ürün işlemi sırasında bir hata oluştu');
      }
    });
  });

  fastify.get(
    '/:productId',
    { preHandler: [validateParams(productIdParamSchema)] },
    async (req, reply) => {
      try {
        const { productId } = req.params as { productId: string };
        const product = await getPublicProductById(productId);
        return reply.status(200).send({ product });
      } catch (error) {
        return handleRouteError(reply, error, 'Ürün alınırken bir hata oluştu');
      }
    }
  );
}
