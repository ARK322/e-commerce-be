import { FastifyInstance } from 'fastify';
import { sellerTeamBase } from '@/middleware/presets/seller-route-guards';
import {
  requireSellerOwner,
  requireSellerPermission,
} from '@/middleware/sellers/require-approved-seller';
import { validateBody } from '@/middleware/validation/validate-body';
import { validateParams } from '@/middleware/validation/validate-params';
import { userIdParamSchema } from '@/shared/validation/param-schemas';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { SELLER_PERMISSIONS } from '@/domain/auth/access/seller/permission-keys';
import {
  createSellerMember,
  deleteSellerMember,
  getSellerMemberByUserId,
  listSellerMembers,
  updateSellerMemberProfile,
  updateSellerMemberRole,
} from '@/features/sellers/members/members.service';
import {
  createSellerMemberSchema,
  updateSellerMemberProfileSchema,
  updateSellerMemberRoleSchema,
  type CreateSellerMemberInput,
  type UpdateSellerMemberProfileInput,
  type UpdateSellerMemberRoleInput,
} from '@/features/sellers/members/create-member.schema';

export default async function (fastify: FastifyInstance) {
  fastify.get(
    '/',
    {
      preHandler: [
        ...sellerTeamBase.preHandler,
        requireSellerPermission(SELLER_PERMISSIONS.MEMBERS_READ),
      ],
    },
    async (req, reply) => {
      try {
        const members = await listSellerMembers(req.sellerContext!);
        return reply.status(200).send({ members });
      } catch (error) {
        return handleRouteError(reply, error, 'Ekip işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.get(
    '/:userId',
    {
      preHandler: [
        ...sellerTeamBase.preHandler,
        validateParams(userIdParamSchema),
      ],
    },
    async (req, reply) => {
      try {
        const { userId } = req.params as { userId: string };
        const member = await getSellerMemberByUserId(req.sellerContext!, userId);
        return reply.status(200).send(member);
      } catch (error) {
        return handleRouteError(reply, error, 'Ekip işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.post(
    '/',
    {
      preHandler: [
        ...sellerTeamBase.preHandler,
        requireSellerOwner,
        validateBody(createSellerMemberSchema),
      ],
    },
    async (req, reply) => {
      try {
        const member = await createSellerMember(
          req.sellerContext!,
          req.body as CreateSellerMemberInput
        );

        return reply.status(201).send({
          message: 'Çalışan eklendi',
          ...member,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Ekip işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.patch(
    '/:userId/role',
    {
      preHandler: [
        ...sellerTeamBase.preHandler,
        requireSellerOwner,
        validateParams(userIdParamSchema),
        validateBody(updateSellerMemberRoleSchema),
      ],
    },
    async (req, reply) => {
      try {
        const { userId } = req.params as { userId: string };
        const member = await updateSellerMemberRole(
          req.sellerContext!,
          userId,
          req.body as UpdateSellerMemberRoleInput
        );

        return reply.status(200).send({
          message: 'Çalışan rolü güncellendi',
          ...member,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Ekip işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.patch(
    '/:userId/profile',
    {
      preHandler: [
        ...sellerTeamBase.preHandler,
        validateParams(userIdParamSchema),
        validateBody(updateSellerMemberProfileSchema),
      ],
    },
    async (req, reply) => {
      try {
        const { userId } = req.params as { userId: string };
        const member = await updateSellerMemberProfile(
          req.sellerContext!,
          userId,
          req.body as UpdateSellerMemberProfileInput
        );

        return reply.status(200).send({
          message: 'Çalışan profili güncellendi',
          ...member,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Ekip işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.delete(
    '/:userId',
    {
      preHandler: [
        ...sellerTeamBase.preHandler,
        requireSellerOwner,
        validateParams(userIdParamSchema),
      ],
    },
    async (req, reply) => {
      try {
        const { userId } = req.params as { userId: string };
        const result = await deleteSellerMember(req.sellerContext!, userId);

        return reply.status(200).send({
          message: 'Çalışan silindi',
          ...result,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Ekip işlemi sırasında bir hata oluştu');
      }
    }
  );
}
