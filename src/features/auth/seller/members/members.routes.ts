import { FastifyInstance } from 'fastify';
import { requireAuth } from '@/features/auth/core/guard/require-auth';
import { requireEmailVerified } from '@/features/auth/core/guard/require-email-verified';
import {
  requireSellerContext,
  requireSellerOwner,
  requireSellerPermission,
  requireKurumsalSeller,
} from '@/lib/ecommerce/guards/require-approved-seller';
import { validateBody } from '@/lib/common/http/validate-body';
import { validateParams } from '@/lib/common/http/validate-params';
import { userIdParamSchema } from '@/lib/common/validation/param-schemas';
import { handleRouteError } from '@/lib/common/http/handle-route-error';
import { SELLER_PERMISSIONS } from '@/features/auth/seller/access/permission-keys';
import {
  createSellerMember,
  deleteSellerMember,
  getSellerMemberByUserId,
  listSellerMembers,
  updateSellerMemberProfile,
  updateSellerMemberRole,
} from '@/features/auth/seller/members/members.service';
import {
  createSellerMemberSchema,
  updateSellerMemberProfileSchema,
  updateSellerMemberRoleSchema,
  type CreateSellerMemberInput,
  type UpdateSellerMemberProfileInput,
  type UpdateSellerMemberRoleInput,
} from '@/features/auth/seller/members/create-member.schema';

const sellerTeamBase = {
  preHandler: [requireAuth, requireEmailVerified, requireSellerContext, requireKurumsalSeller],
};

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
