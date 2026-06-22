import { FastifyInstance } from 'fastify';
import { validateParams } from '@/shared/middleware/validation/validate-params';
import { validateQuery } from '@/shared/middleware/validation/validate-query';
import { productIdParamSchema } from '@/shared/validation/param-schemas';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { setPublicCacheControl } from '@/domains/catalog/infrastructure/cache/public-http-cache';
import {
  listProductsQuerySchema,
  type ListProductsQuery,
} from '@/api/public/catalog/products/list-products.schema';
import {
  getPublicProductById,
  listPublicProducts,
} from '@/api/public/catalog/products/product.service';

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
