import { FastifyInstance } from 'fastify';
import { adminOnly } from '@/middleware/presets/admin-route-guards';
import { requirePermission } from '@/middleware/auth/require-admin';
import { validateBody } from '@/middleware/validation/validate-body';
import { validateParams } from '@/middleware/validation/validate-params';
import { categoryIdParamSchema } from '@/internal/common/validation/param-schemas';
import { handleRouteError } from '@/internal/common/errors/handle-route-error';
import { PERMISSIONS } from '@/internal/auth/access/admin/permission-keys';
import {
  createCategorySchema,
  type CreateCategoryInput,
} from '@/features/admin/categories/create-category.schema';
import {
  linkCategorySchema,
  type LinkCategoryInput,
} from '@/features/admin/categories/link-category.schema';
import {
  updateCategorySchema,
  type UpdateCategoryInput,
} from '@/features/admin/categories/update-category.schema';
import {
  createCategory,
  deleteCategory,
  getCategoryById,
  linkCategory,
  listAdminCategories,
  unlinkCategory,
  updateCategory,
} from '@/features/admin/categories/admin-categories.service';

const adminWithCategoryId = {
  preHandler: [...adminOnly.preHandler, validateParams(categoryIdParamSchema)],
};

export default async function categoriesAdminRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: [...adminOnly.preHandler, requirePermission(PERMISSIONS.CATEGORIES_READ)] },
    async (_req, reply) => {
      try {
        const categories = await listAdminCategories();
        return reply.status(200).send({ categories });
      } catch (error) {
        return handleRouteError(reply, error, 'Kategori işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.get(
    '/:categoryId',
    {
      preHandler: [
        ...adminWithCategoryId.preHandler,
        requirePermission(PERMISSIONS.CATEGORIES_READ),
      ],
    },
    async (req, reply) => {
      try {
        const { categoryId } = req.params as { categoryId: string };
        const category = await getCategoryById(categoryId);
        return reply.status(200).send({ category });
      } catch (error) {
        return handleRouteError(reply, error, 'Kategori işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.post(
    '/',
    {
      preHandler: [
        ...adminOnly.preHandler,
        requirePermission(PERMISSIONS.CATEGORIES_WRITE),
        validateBody(createCategorySchema),
      ],
    },
    async (req, reply) => {
      try {
        const category = await createCategory(req.body as CreateCategoryInput);
        return reply.status(201).send({
          message: 'Kategori oluşturuldu',
          category,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Kategori işlemi sırasında bir hata oluştu', {
          duplicateKeyMessage: 'Bu slug zaten kullanılıyor',
        });
      }
    }
  );

  fastify.patch(
    '/:categoryId',
    {
      preHandler: [
        ...adminWithCategoryId.preHandler,
        requirePermission(PERMISSIONS.CATEGORIES_WRITE),
        validateBody(updateCategorySchema),
      ],
    },
    async (req, reply) => {
      try {
        const { categoryId } = req.params as { categoryId: string };
        const category = await updateCategory(categoryId, req.body as UpdateCategoryInput);

        return reply.status(200).send({
          message: 'Kategori güncellendi',
          category,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Kategori işlemi sırasında bir hata oluştu', {
          duplicateKeyMessage: 'Bu slug zaten kullanılıyor',
        });
      }
    }
  );

  fastify.post(
    '/:categoryId/links',
    {
      preHandler: [
        ...adminWithCategoryId.preHandler,
        requirePermission(PERMISSIONS.CATEGORIES_WRITE),
        validateBody(linkCategorySchema),
      ],
    },
    async (req, reply) => {
      try {
        const { categoryId } = req.params as { categoryId: string };
        const { message, category, orphanedProductCount } = await linkCategory(
          categoryId,
          req.body as LinkCategoryInput
        );

        return reply.status(200).send({
          message,
          category,
          orphanedProductCount,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Kategori işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.delete(
    '/:categoryId/links',
    {
      preHandler: [
        ...adminWithCategoryId.preHandler,
        requirePermission(PERMISSIONS.CATEGORIES_WRITE),
        validateBody(linkCategorySchema),
      ],
    },
    async (req, reply) => {
      try {
        const { categoryId } = req.params as { categoryId: string };
        const category = await unlinkCategory(categoryId, req.body as LinkCategoryInput);

        return reply.status(200).send({
          message: 'Kategori bağlantısı kaldırıldı',
          category,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Kategori işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.delete(
    '/:categoryId',
    {
      preHandler: [
        ...adminWithCategoryId.preHandler,
        requirePermission(PERMISSIONS.CATEGORIES_WRITE),
      ],
    },
    async (req, reply) => {
      try {
        const { categoryId } = req.params as { categoryId: string };
        await deleteCategory(categoryId);

        return reply.status(200).send({ message: 'Kategori silindi' });
      } catch (error) {
        return handleRouteError(reply, error, 'Kategori işlemi sırasında bir hata oluştu');
      }
    }
  );
}
