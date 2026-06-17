import { FastifyInstance } from 'fastify';
import { validateParams } from '@/lib/common/http/validate-params';
import { categoryIdParamSchema } from '@/lib/common/validation/param-schemas';
import { handleRouteError } from '@/lib/common/http/handle-route-error';
import {
  getCategoryById,
  getCategoryPaths,
  listPublicCategories,
} from '@/features/ecommerce/category/category.service';

export default async function categoryRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (_req, reply) => {
    try {
      const categories = await listPublicCategories();
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

        return reply.status(200).send({ categoryId, paths });
      } catch (error) {
        return handleRouteError(reply, error, 'Kategori yolları alınırken bir hata oluştu');
      }
    }
  );
}
