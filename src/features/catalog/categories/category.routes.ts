import { FastifyInstance } from 'fastify';
import { validateParams } from '@/middleware/validation/validate-params';
import { categoryIdParamSchema } from '@/internal/common/validation/param-schemas';
import { handleRouteError } from '@/internal/common/errors/handle-route-error';
import { setPublicCacheControl } from '@/internal/common/cache/public-http-cache';
import {
  getCategoryById,
  getCategoryPaths,
  listPublicCategories,
} from '@/features/catalog/categories/category.service';

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
        const category = await getCategoryById(categoryId);

        if (!category.isActive) {
          return reply.status(404).send({ message: 'Kategori bulunamadı' });
        }

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
