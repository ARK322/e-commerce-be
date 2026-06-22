import { FastifyInstance } from 'fastify';
import { sellerTeamBase } from '@/shared/middleware/presets/seller-route-guards';
import {
  requireSellerOwner,
  requireSellerPermission,
} from '@/shared/middleware/sellers/require-approved-seller';
import { validateBody } from '@/shared/middleware/validation/validate-body';
import { validateParams } from '@/shared/middleware/validation/validate-params';
import { roleIdParamSchema } from '@/shared/validation/param-schemas';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { SELLER_PERMISSIONS } from '@/domains/identity/application/access/seller/permission-keys';
import {
  createSellerRole,
  deleteSellerRole,
  getSellerRoleById,
  listAssignableSellerRoles,
  listSellerPermissionRegistry,
  listSellerRoles,
  updateSellerRole,
} from '@/api/seller/roles/roles.service';
import {
  createSellerRoleSchema,
  updateSellerRoleSchema,
  type CreateSellerRoleInput,
  type UpdateSellerRoleInput,
} from '@/api/seller/roles/create-role.schema';

export default async function (fastify: FastifyInstance) {
  fastify.get(
    '/permissions',
    {
      preHandler: [
        ...sellerTeamBase.preHandler,
        requireSellerPermission(SELLER_PERMISSIONS.ROLES_READ),
      ],
    },
    async (_req, reply) => {
      return reply.status(200).send({ permissions: listSellerPermissionRegistry() });
    }
  );

  fastify.get(
    '/assignable',
    { preHandler: [...sellerTeamBase.preHandler, requireSellerOwner] },
    async (req, reply) => {
      try {
        const roles = await listAssignableSellerRoles(req.sellerContext!);
        return reply.status(200).send({ roles });
      } catch (error) {
        return handleRouteError(reply, error, 'Rol işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.get(
    '/',
    {
      preHandler: [
        ...sellerTeamBase.preHandler,
        requireSellerPermission(SELLER_PERMISSIONS.ROLES_READ),
      ],
    },
    async (req, reply) => {
      try {
        const roles = await listSellerRoles(req.sellerContext!);
        return reply.status(200).send({ roles });
      } catch (error) {
        return handleRouteError(reply, error, 'Rol işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.get(
    '/:roleId',
    {
      preHandler: [
        ...sellerTeamBase.preHandler,
        requireSellerPermission(SELLER_PERMISSIONS.ROLES_READ),
        validateParams(roleIdParamSchema),
      ],
    },
    async (req, reply) => {
      try {
        const { roleId } = req.params as { roleId: string };
        const role = await getSellerRoleById(req.sellerContext!, roleId);
        return reply.status(200).send(role);
      } catch (error) {
        return handleRouteError(reply, error, 'Rol işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.post(
    '/',
    {
      preHandler: [
        ...sellerTeamBase.preHandler,
        requireSellerOwner,
        validateBody(createSellerRoleSchema),
      ],
    },
    async (req, reply) => {
      try {
        const role = await createSellerRole(req.sellerContext!, req.body as CreateSellerRoleInput);

        return reply.status(201).send({
          message: 'Rol oluşturuldu',
          ...role,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Rol işlemi sırasında bir hata oluştu', {
          duplicateKeyMessage: 'Bu slug zaten kullanılıyor',
        });
      }
    }
  );

  fastify.patch(
    '/:roleId',
    {
      preHandler: [
        ...sellerTeamBase.preHandler,
        requireSellerOwner,
        validateParams(roleIdParamSchema),
        validateBody(updateSellerRoleSchema),
      ],
    },
    async (req, reply) => {
      try {
        const { roleId } = req.params as { roleId: string };
        const role = await updateSellerRole(
          req.sellerContext!,
          roleId,
          req.body as UpdateSellerRoleInput
        );

        return reply.status(200).send({
          message: 'Rol güncellendi',
          ...role,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Rol işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.delete(
    '/:roleId',
    {
      preHandler: [
        ...sellerTeamBase.preHandler,
        requireSellerOwner,
        validateParams(roleIdParamSchema),
      ],
    },
    async (req, reply) => {
      try {
        const { roleId } = req.params as { roleId: string };
        const result = await deleteSellerRole(req.sellerContext!, roleId);

        return reply.status(200).send({
          message: 'Rol silindi',
          ...result,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Rol işlemi sırasında bir hata oluştu');
      }
    }
  );
}
