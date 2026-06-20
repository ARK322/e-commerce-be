import { FastifyInstance } from 'fastify';
import { validateParams } from '@/middleware/validation/validate-params';
import { validateQuery } from '@/middleware/validation/validate-query';
import { productIdParamSchema } from '@/internal/common/validation/param-schemas';
import { handleRouteError } from '@/internal/common/errors/handle-route-error';
import { setPublicCacheControl } from '@/internal/common/cache/public-http-cache';
import {
  listProductsQuerySchema,
  type ListProductsQuery,
} from '@/features/catalog/products/list-products.schema';
import {
  getPublicProductById,
  listPublicProducts,
} from '@/features/catalog/products/product.service';

export default async function productRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: [validateQuery(listProductsQuerySchema)] },
    async (req, reply) => {
      try {
        const result = await listPublicProducts(req.query as ListProductsQuery);
        setPublicCacheControl(reply, 'productsList');
        return reply.status(200).send(result);
      } catch (error) {
        return handleRouteError(reply, error, 'Ürünler alınırken bir hata oluştu');
      }
    }
  );

  fastify.get(
    '/:productId',
    { preHandler: [validateParams(productIdParamSchema)] },
    async (req, reply) => {
      try {
        const { productId } = req.params as { productId: string };
        const product = await getPublicProductById(productId);
        setPublicCacheControl(reply, 'productDetail');
        return reply.status(200).send({ product });
      } catch (error) {
        return handleRouteError(reply, error, 'Ürün alınırken bir hata oluştu');
      }
    }
  );
}
