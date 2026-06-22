import type { FastifyInstance } from 'fastify';
import { adminOnly } from '@/middleware/presets/admin-route-guards';
import { validateQuery } from '@/middleware/validation/validate-query';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { listPaymentAuditLogs } from '@/features/admin/payment-audit/payment-audit.service';
import {
  listPaymentAuditLogsQuerySchema,
  type ListPaymentAuditLogsQuery,
} from '@/features/admin/payment-audit/list-payment-audit.schema';

export default async function paymentAuditRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    {
      preHandler: [...adminOnly.preHandler, validateQuery(listPaymentAuditLogsQuerySchema)],
    },
    async (req, reply) => {
      try {
        if (!req.adminContext) {
          return reply.status(403).send({ message: 'Admin profili bulunamadı' });
        }

        const result = await listPaymentAuditLogs(
          req.adminContext,
          req.query as ListPaymentAuditLogsQuery
        );

        return reply.status(200).send(result);
      } catch (error) {
        return handleRouteError(reply, error, 'Ödeme denetim kayıtları alınırken bir hata oluştu');
      }
    }
  );
}
