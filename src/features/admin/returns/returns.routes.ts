import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminOnly } from '@/middleware/presets/admin-route-guards';
import { requirePermission } from '@/middleware/auth/require-admin';
import { validateBody } from '@/middleware/validation/validate-body';
import { validateParams } from '@/middleware/validation/validate-params';
import { validateQuery } from '@/middleware/validation/validate-query';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { PERMISSIONS } from '@/domain/auth/access/admin/permission-keys';
import {
  listReturnRequestsQuerySchema,
  reviewReturnRequestSchema,
  type ListReturnRequestsQuery,
  type ReviewReturnRequestInput,
} from '@/features/admin/returns/returns.schema';
import {
  listAdminReturnRequests,
  reviewAdminReturnRequest,
} from '@/features/admin/returns/returns.service';

const returnIdParamSchema = z.object({
  requestId: z.string().uuid(),
});

export default async function adminReturnsRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    {
      preHandler: [
        ...adminOnly.preHandler,
        requirePermission(PERMISSIONS.SUPPORT_READ),
        validateQuery(listReturnRequestsQuerySchema),
      ],
    },
    async (req, reply) => {
      try {
        const result = await listAdminReturnRequests(
          req.adminContext!,
          req.query as ListReturnRequestsQuery
        );
        return reply.status(200).send(result);
      } catch (error) {
        return handleRouteError(reply, error, 'İade talepleri alınırken bir hata oluştu');
      }
    }
  );

  fastify.patch(
    '/:requestId',
    {
      preHandler: [
        ...adminOnly.preHandler,
        requirePermission(PERMISSIONS.SUPPORT_WRITE),
        validateParams(returnIdParamSchema),
        validateBody(reviewReturnRequestSchema),
      ],
    },
    async (req, reply) => {
      try {
        const { requestId } = req.params as { requestId: string };
        const returnRequest = await reviewAdminReturnRequest(
          req.adminContext!,
          requestId,
          req.body as ReviewReturnRequestInput
        );

        return reply.status(200).send({
          message: 'İade talebi güncellendi',
          returnRequest,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'İade talebi güncellenirken bir hata oluştu');
      }
    }
  );
}
