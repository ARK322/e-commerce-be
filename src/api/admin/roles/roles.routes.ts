import { FastifyInstance } from 'fastify';
import { adminOnly } from '@/shared/middleware/presets/admin-route-guards';
import {
  requireOwner,
  requirePermission,
} from '@/shared/middleware/auth/require-admin';
import { validateBody } from '@/shared/middleware/validation/validate-body';
import { validateParams } from '@/shared/middleware/validation/validate-params';
import { roleIdParamSchema } from '@/shared/validation/param-schemas';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { PERMISSIONS } from '@/domains/identity/application/access/admin/permission-keys';
import {
  createAdminRole,
  deleteAdminRole,
  getAdminRoleById,
  listAdminRoles,
  listAssignableRoles,
  listPermissionRegistry,
  updateAdminRole,
} from '@/api/admin/roles/roles.service';
import {
  createAdminRoleSchema,
  updateAdminRoleSchema,
  type CreateAdminRoleInput,
  type UpdateAdminRoleInput,
} from '@/api/admin/roles/create-role.schema';

export default async function (fastify: FastifyInstance) {
  fastify.get(
    '/permissions',
    { preHandler: [...adminOnly.preHandler, requirePermission(PERMISSIONS.ADMIN_ROLES_READ)] },
    async (_req, reply) => {
      return reply.status(200).send({ permissions: listPermissionRegistry() });
    }
  );

  fastify.get(
    '/assignable',
    { preHandler: [...adminOnly.preHandler, requireOwner] },
    async (req, reply) => {
      try {
        const roles = await listAssignableRoles(req.adminContext!);
        return reply.status(200).send({ roles });
      } catch (error) {
        return handleRouteError(reply, error, 'Rol işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.get(
    '/',
    { preHandler: [...adminOnly.preHandler, requirePermission(PERMISSIONS.ADMIN_ROLES_READ)] },
    async (req, reply) => {
      try {
        const roles = await listAdminRoles(req.adminContext!);
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
        ...adminOnly.preHandler,
        requirePermission(PERMISSIONS.ADMIN_ROLES_READ),
        validateParams(roleIdParamSchema),
      ],
    },
    async (req, reply) => {
      try {
        const { roleId } = req.params as { roleId: string };
        const role = await getAdminRoleById(req.adminContext!, roleId);
        return reply.status(200).send(role);
      } catch (error) {
        return handleRouteError(reply, error, 'Rol işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.post(
    '/',
    {
      preHandler: [...adminOnly.preHandler, requireOwner, validateBody(createAdminRoleSchema)],
    },
    async (req, reply) => {
      try {
        const role = await createAdminRole(req.adminContext!, req.body as CreateAdminRoleInput);

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
        ...adminOnly.preHandler,
        requireOwner,
        validateParams(roleIdParamSchema),
        validateBody(updateAdminRoleSchema),
      ],
    },
    async (req, reply) => {
      try {
        const { roleId } = req.params as { roleId: string };
        const role = await updateAdminRole(
          req.adminContext!,
          roleId,
          req.body as UpdateAdminRoleInput
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
      preHandler: [...adminOnly.preHandler, requireOwner, validateParams(roleIdParamSchema)],
    },
    async (req, reply) => {
      try {
        const { roleId } = req.params as { roleId: string };
        const result = await deleteAdminRole(req.adminContext!, roleId);

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
