import { FastifyInstance, FastifyReply } from 'fastify';
import { requireAuth } from '../../../../lib/common/middleware/require-auth';
import { requireAdmin } from '../../../../lib/auth/middleware/require-admin';
import { validateBody } from '../../../../lib/common/middleware/validate-body';
import { validateParams } from '../../../../lib/common/middleware/validate-params';
import { validateQuery } from '../../../../lib/common/middleware/validate-query';
import { userIdParamSchema } from '../../../../lib/common/validation/param-schemas';
import { RegisterError } from '../../register/register.errors';
import { listSellersQuerySchema, type ListSellersQuery } from './schemas/list-sellers.schema';
import { rejectSellerSchema, type RejectSellerInput } from './schemas/reject-seller.schema';
import { approveSeller, getSellerByUserId, listSellers, rejectSeller } from './sellers.service';

const handleSellerAdminError = (reply: FastifyReply, error: unknown) => {
  if (error instanceof RegisterError) {
    return reply.status(error.statusCode).send({ message: error.message });
  }

  return reply.status(500).send({ message: 'Satıcı işlemi sırasında bir hata oluştu' });
};

const adminOnly = { preHandler: [requireAuth, requireAdmin] };
const adminWithUserId = {
  preHandler: [requireAuth, requireAdmin, validateParams(userIdParamSchema)],
};

export default async function (fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: [...adminOnly.preHandler, validateQuery(listSellersQuerySchema)] },
    async (req, reply) => {
      try {
        const { status } = req.query as ListSellersQuery;
        const sellers = await listSellers(status);
        return reply.status(200).send({ sellers });
      } catch (error) {
        return handleSellerAdminError(reply, error);
      }
    }
  );

  fastify.get('/:userId', adminWithUserId, async (req, reply) => {
    try {
      const { userId } = req.params as { userId: string };
      const seller = await getSellerByUserId(userId);
      return reply.status(200).send(seller);
    } catch (error) {
      return handleSellerAdminError(reply, error);
    }
  });

  fastify.post('/:userId/approve', adminWithUserId, async (req, reply) => {
    try {
      if (!req.adminRole) {
        return reply.status(403).send({ message: 'Admin profili bulunamadı' });
      }

      const { userId } = req.params as { userId: string };
      const result = await approveSeller(req.adminRole, userId);

      return reply.status(200).send({
        message: 'Satıcı onaylandı',
        ...result,
      });
    } catch (error) {
      return handleSellerAdminError(reply, error);
    }
  });

  fastify.post(
    '/:userId/reject',
    {
      preHandler: [
        requireAuth,
        requireAdmin,
        validateParams(userIdParamSchema),
        validateBody(rejectSellerSchema),
      ],
    },
    async (req, reply) => {
      try {
        if (!req.adminRole) {
          return reply.status(403).send({ message: 'Admin profili bulunamadı' });
        }

        const { userId } = req.params as { userId: string };
        const { reason } = req.body as RejectSellerInput;
        const result = await rejectSeller(req.adminRole, userId, reason);

        return reply.status(200).send({
          message: 'Satıcı reddedildi',
          ...result,
        });
      } catch (error) {
        return handleSellerAdminError(reply, error);
      }
    }
  );
}
