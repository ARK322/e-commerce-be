import type { FastifyInstance } from 'fastify';
import { registerProductMultipart } from '@/shared/plugins/multipart/product';
import { SELLERS_WRITE_RATE_LIMIT } from '@/shared/middleware/presets/rate-limit';
import { registerScopedRateLimit } from '@/shared/plugins/rate-limit/register-scoped';
import { requireAuth } from '@/shared/middleware/auth/require-auth';
import { requireEmailVerified } from '@/shared/middleware/auth/require-email-verified';
import {
  requireApprovedSeller,
  requireSellerPermission,
} from '@/shared/middleware/sellers/require-approved-seller';
import { validateBody } from '@/shared/middleware/validation/validate-body';
import { validateParams } from '@/shared/middleware/validation/validate-params';
import { productIdParamSchema } from '@/shared/validation/param-schemas';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { SELLER_PERMISSIONS } from '@/domains/identity/application/access/seller/permission-keys';
import {
  updateProductSchema,
  type UpdateProductInput,
} from '@/api/seller/products/update-product.schema';
import {
  createProductFromRequest,
  deleteProduct,
  listSellerProducts,
  updateProduct,
  addProductImage,
  removeProductImage,
} from '@/api/seller/products/seller-products.service';
import {
  deleteProductImageSchema,
  type DeleteProductImageInput,
} from '@/api/seller/products/delete-product-image.schema';

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
  preHandler: [...sellerWrite.preHandler, validateParams(productIdParamSchema)],
};

export default async function productRoutes(fastify: FastifyInstance) {
  await registerProductMultipart(fastify);
  await registerScopedRateLimit(fastify, SELLERS_WRITE_RATE_LIMIT);

  fastify.get('/mine', sellerRead, async (req, reply) => {
    try {
      const products = await listSellerProducts(req.sellerContext!.companyId);
      return reply.status(200).send({ products });
    } catch (error) {
      return handleRouteError(reply, error, 'Ürün işlemi sırasında bir hata oluştu');
    }
  });

  fastify.post('/', sellerWrite, async (req, reply) => {
    try {
      const { product, imageCount } = await createProductFromRequest(
        req.sellerContext!.companyId,
        req
      );

      return reply.status(201).send({
        message: imageCount > 0 ? 'Ürün ve görseller oluşturuldu' : 'Ürün oluşturuldu',
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
      const result = await addProductImage(
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
        const result = await removeProductImage(
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
