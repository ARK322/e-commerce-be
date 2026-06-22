import type { FastifyInstance } from 'fastify';
import { sellerTeamBase } from '@/shared/middleware/presets/seller-route-guards';
import { requireSellerPermission } from '@/shared/middleware/sellers/require-approved-seller';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { SELLER_PERMISSIONS } from '@/domains/identity/application/access/seller/permission-keys';
import { getSellerWalletForCompany } from '@/api/seller/wallet/wallet.service';

export default async function walletRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    {
      preHandler: [
        ...sellerTeamBase.preHandler,
        requireSellerPermission(SELLER_PERMISSIONS.ORDERS_READ),
      ],
    },
    async (req, reply) => {
      try {
        const wallet = await getSellerWalletForCompany(req.sellerContext!.companyId);
        return reply.status(200).send({ wallet });
      } catch (error) {
        return handleRouteError(reply, error, 'Cüzdan bilgisi alınırken bir hata oluştu');
      }
    }
  );
}
