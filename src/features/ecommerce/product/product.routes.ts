import { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { requireAuth } from '@/features/auth/core/guard/require-auth';
import { requireEmailVerified } from '@/features/auth/core/guard/require-email-verified';
import {
  requireApprovedSeller,
  requireSellerPermission,
} from '@/lib/ecommerce/guards/require-approved-seller';
import { validateBody } from '@/lib/common/http/validate-body';
import { validateParams } from '@/lib/common/http/validate-params';
import { validateQuery } from '@/lib/common/http/validate-query';
import { productIdParamSchema } from '@/lib/common/validation/param-schemas';
import { handleRouteError } from '@/lib/common/http/handle-route-error';
import { SELLER_PERMISSIONS } from '@/features/auth/seller/access/permission-keys';
import {
  updateProductSchema,
  type UpdateProductInput,
} from '@/features/ecommerce/product/update-product.schema';
import {
  listProductsQuerySchema,
  type ListProductsQuery,
} from '@/features/ecommerce/product/list-products.schema';
import { parseCreateProductRequest } from '@/features/ecommerce/product/parse-create-product-request';
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
} from '@/features/ecommerce/product/product-images.service';
import {
  deleteProductImageSchema,
  type DeleteProductImageInput,
} from '@/features/ecommerce/product/delete-product-image.schema';
import { MAX_PRODUCT_IMAGE_BYTES, MAX_PRODUCT_IMAGES } from '@/features/ecommerce/product/product-image-types';

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
  await fastify.register(multipart, {
    limits: {
      fileSize: MAX_PRODUCT_IMAGE_BYTES,
      files: MAX_PRODUCT_IMAGES,
    },
  });

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

  fastify.get('/mine', sellerRead, async (req, reply) => {
    try {
      const products = await listSellerProducts(req.sellerContext!.companyId);
      return reply.status(200).send({ products });
    } catch (error) {
      return handleRouteError(reply, error, 'Ürün işlemi sırasında bir hata oluştu');
    }
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

  fastify.post('/', sellerWrite, async (req, reply) => {
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

  fastify.patch(
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

  fastify.post('/:productId/images', sellerWriteWithProductId, async (req, reply) => {
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

  fastify.delete(
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

  fastify.delete('/:productId', sellerWriteWithProductId, async (req, reply) => {
    try {
      const { productId } = req.params as { productId: string };
      await deleteProduct(req.sellerContext!.companyId, productId);

      return reply.status(200).send({ message: 'Ürün silindi' });
    } catch (error) {
      return handleRouteError(reply, error, 'Ürün işlemi sırasında bir hata oluştu');
    }
  });
}
