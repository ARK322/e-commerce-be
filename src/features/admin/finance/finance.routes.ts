import { FastifyInstance } from 'fastify';
import { adminOnly } from '@/middleware/presets/admin-route-guards';
import { requirePermission } from '@/middleware/auth/require-admin';
import { validateQuery } from '@/middleware/validation/validate-query';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { PERMISSIONS } from '@/domain/auth/access/admin/permission-keys';
import {
  financeReportQuerySchema,
  type FinanceReportQuery,
} from '@/features/admin/finance/finance.schema';
import {
  exportFinanceSplitsCsv,
  getFinanceBySeller,
  getFinanceSummary,
} from '@/features/admin/finance/finance.service';

export default async function adminFinanceRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/summary',
    {
      preHandler: [
        ...adminOnly.preHandler,
        requirePermission(PERMISSIONS.FINANCE_READ),
        validateQuery(financeReportQuerySchema),
      ],
    },
    async (req, reply) => {
      try {
        const result = await getFinanceSummary(req.adminContext!, req.query as FinanceReportQuery);
        return reply.status(200).send(result);
      } catch (error) {
        return handleRouteError(reply, error, 'Finans özeti alınırken bir hata oluştu');
      }
    }
  );

  fastify.get(
    '/by-seller',
    {
      preHandler: [
        ...adminOnly.preHandler,
        requirePermission(PERMISSIONS.FINANCE_READ),
        validateQuery(financeReportQuerySchema),
      ],
    },
    async (req, reply) => {
      try {
        const result = await getFinanceBySeller(req.adminContext!, req.query as FinanceReportQuery);
        return reply.status(200).send(result);
      } catch (error) {
        return handleRouteError(reply, error, 'Satıcı finans raporu alınırken bir hata oluştu');
      }
    }
  );

  fastify.get(
    '/export',
    {
      preHandler: [
        ...adminOnly.preHandler,
        requirePermission(PERMISSIONS.FINANCE_EXPORT),
        validateQuery(financeReportQuerySchema),
      ],
    },
    async (req, reply) => {
      try {
        const csv = await exportFinanceSplitsCsv(req.adminContext!, req.query as FinanceReportQuery);
        return reply
          .header('content-type', 'text/csv; charset=utf-8')
          .header('content-disposition', 'attachment; filename="finance-splits.csv"')
          .status(200)
          .send(csv);
      } catch (error) {
        return handleRouteError(reply, error, 'Finans dışa aktarma sırasında bir hata oluştu');
      }
    }
  );
}
