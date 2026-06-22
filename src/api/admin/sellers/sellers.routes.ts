import { FastifyInstance } from 'fastify';
import { adminOnly } from '@/shared/middleware/presets/admin-route-guards';
import { requirePermission } from '@/shared/middleware/auth/require-admin';
import { validateBody } from '@/shared/middleware/validation/validate-body';
import { validateParams } from '@/shared/middleware/validation/validate-params';
import { validateQuery } from '@/shared/middleware/validation/validate-query';
import { userIdParamSchema } from '@/shared/validation/param-schemas';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { PERMISSIONS } from '@/domains/identity/application/access/admin/permission-keys';
import { listSellersQuerySchema, type ListSellersQuery } from '@/api/admin/sellers/list-sellers.schema';
import { rejectSellerSchema, type RejectSellerInput } from '@/api/admin/sellers/reject-seller.schema';
import {
  approveSeller,
  getSellerByUserId,
  getSellerWalletByUserId,
  listSellers,
  rejectSeller,
  setSellerActiveStatus,
  syncSellerIyzicoSubMerchant,
} from '@/api/admin/sellers/sellers.service';
import { setUserActiveStatusSchema, type SetUserActiveStatusInput } from '@/api/admin/common/set-user-active.schema';

const adminWithUserId = {
  preHandler: [...adminOnly.preHandler, validateParams(userIdParamSchema)],
};

export default async function (fastify: FastifyInstance) {
  fastify.get(
    '/',
    {
      preHandler: [
        ...adminOnly.preHandler,
        requirePermission(PERMISSIONS.SELLERS_READ),
        validateQuery(listSellersQuerySchema),
      ],
    },
    async (req, reply) => {
      try {
        const { status } = req.query as ListSellersQuery;
        const sellers = await listSellers(req.adminContext!, status);
        return reply.status(200).send({ sellers });
      } catch (error) {
        return handleRouteError(reply, error, 'Satıcı işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.get(
    '/:userId',
    {
      preHandler: [
        ...adminWithUserId.preHandler,
        requirePermission(PERMISSIONS.SELLERS_READ),
      ],
    },
    async (req, reply) => {
      try {
        const { userId } = req.params as { userId: string };
        const seller = await getSellerByUserId(req.adminContext!, userId);
        return reply.status(200).send(seller);
      } catch (error) {
        return handleRouteError(reply, error, 'Satıcı işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.get(
    '/:userId/wallet',
    {
      preHandler: [
        ...adminWithUserId.preHandler,
        requirePermission(PERMISSIONS.SELLERS_READ),
      ],
    },
    async (req, reply) => {
      try {
        const { userId } = req.params as { userId: string };
        const wallet = await getSellerWalletByUserId(req.adminContext!, userId);
        return reply.status(200).send({ wallet });
      } catch (error) {
        return handleRouteError(reply, error, 'Satıcı cüzdan bilgisi alınırken bir hata oluştu');
      }
    }
  );

  fastify.post(
    '/:userId/approve',
    {
      preHandler: [
        ...adminWithUserId.preHandler,
        requirePermission(PERMISSIONS.SELLERS_APPROVE),
      ],
    },
    async (req, reply) => {
      try {
        const { userId } = req.params as { userId: string };
        const result = await approveSeller(req.adminContext!, userId);

        return reply.status(200).send({
          message: 'Satıcı onaylandı',
          ...result,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Satıcı işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.post(
    '/:userId/iyzico-sync',
    {
      preHandler: [
        ...adminWithUserId.preHandler,
        requirePermission(PERMISSIONS.SELLERS_APPROVE),
      ],
    },
    async (req, reply) => {
      try {
        const { userId } = req.params as { userId: string };
        const result = await syncSellerIyzicoSubMerchant(req.adminContext!, userId);

        return reply.status(200).send({
          message: result.created
            ? 'Iyzico alt üye kaydı oluşturuldu'
            : 'Satıcının Iyzico alt üye kaydı zaten mevcut',
          ...result,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Iyzico kaydı sırasında bir hata oluştu');
      }
    }
  );

  fastify.post(
    '/:userId/reject',
    {
      preHandler: [
        ...adminOnly.preHandler,
        requirePermission(PERMISSIONS.SELLERS_APPROVE),
        validateParams(userIdParamSchema),
        validateBody(rejectSellerSchema),
      ],
    },
    async (req, reply) => {
      try {
        const { userId } = req.params as { userId: string };
        const { reason } = req.body as RejectSellerInput;
        const result = await rejectSeller(req.adminContext!, userId, reason);

        return reply.status(200).send({
          message: 'Satıcı reddedildi',
          ...result,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Satıcı işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.patch(
    '/:userId/active',
    {
      preHandler: [
        ...adminWithUserId.preHandler,
        requirePermission(PERMISSIONS.SELLERS_APPROVE),
        validateBody(setUserActiveStatusSchema),
      ],
    },
    async (req, reply) => {
      try {
        const { userId } = req.params as { userId: string };
        const result = await setSellerActiveStatus(
          req.adminContext!,
          userId,
          req.body as SetUserActiveStatusInput
        );

        return reply.status(200).send({
          message: 'Satıcı hesap durumu güncellendi',
          ...result,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Satıcı işlemi sırasında bir hata oluştu');
      }
    }
  );
}
