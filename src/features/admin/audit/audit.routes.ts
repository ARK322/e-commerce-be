import { FastifyInstance } from 'fastify';
import { adminOnly } from '@/middleware/presets/admin-route-guards';
import { validateQuery } from '@/middleware/validation/validate-query';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { listAdminAuditLogs } from '@/features/admin/audit/audit.service';
import {
  listAdminAuditLogsQuerySchema,
  type ListAdminAuditLogsQuery,
} from '@/features/admin/audit/list-audit.schema';

export default async function auditRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    {
      preHandler: [...adminOnly.preHandler, validateQuery(listAdminAuditLogsQuerySchema)],
    },
    async (req, reply) => {
      try {
        if (!req.adminContext) {
          return reply.status(403).send({ message: 'Admin profili bulunamadı' });
        }

        const result = await listAdminAuditLogs(
          req.adminContext,
          req.query as ListAdminAuditLogsQuery
        );

        return reply.status(200).send(result);
      } catch (error) {
        return handleRouteError(reply, error, 'Denetim kayıtları alınırken bir hata oluştu');
      }
    }
  );
}
