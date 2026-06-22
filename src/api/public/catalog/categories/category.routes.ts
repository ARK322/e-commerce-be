import { FastifyInstance } from 'fastify';
import { validateParams } from '@/shared/middleware/validation/validate-params';
import { categoryIdParamSchema } from '@/shared/validation/param-schemas';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { setPublicCacheControl } from '@/domains/catalog/infrastructure/cache/public-http-cache';
import {
  getPublicCategoryById,
  getCategoryPaths,
  listPublicCategories,
} from '@/api/public/catalog/categories/category.service';

export default async function categoryRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (_req, reply) => {
    try {
      const categories = await listPublicCategories();
      setPublicCacheControl(reply, 'categories');
      return reply.status(200).send({ categories });
    } catch (error) {
      return handleRouteError(reply, error, 'Kategoriler alınırken bir hata oluştu');
    }
  });

  fastify.get(
    '/:categoryId',
    { preHandler: [validateParams(categoryIdParamSchema)] },
    async (req, reply) => {
      try {
        const { categoryId } = req.params as { categoryId: string };
        const category = await getPublicCategoryById(categoryId);

        setPublicCacheControl(reply, 'categories');
        return reply.status(200).send({ category });
      } catch (error) {
        return handleRouteError(reply, error, 'Kategori alınırken bir hata oluştu');
      }
    }
  );

  fastify.get(
    '/:categoryId/paths',
    { preHandler: [validateParams(categoryIdParamSchema)] },
    async (req, reply) => {
      try {
        const { categoryId } = req.params as { categoryId: string };
        const paths = await getCategoryPaths(categoryId);

        setPublicCacheControl(reply, 'categories');
        return reply.status(200).send({ categoryId, paths });
      } catch (error) {
        return handleRouteError(reply, error, 'Kategori yolları alınırken bir hata oluştu');
      }
    }
  );
}
