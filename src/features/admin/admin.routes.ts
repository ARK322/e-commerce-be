import { FastifyInstance } from 'fastify';
import adminsRoutes from '@/features/admin/admins/admins.routes';
import auditRoutes from '@/features/admin/audit/audit.routes';
import categoriesAdminRoutes from '@/features/admin/categories/categories.routes';
import paymentAuditRoutes from '@/features/admin/payment-audit/payment-audit.routes';
import profileRoutes from '@/features/admin/profile/profile.routes';
import rolesRoutes from '@/features/admin/roles/roles.routes';
import sellersRoutes from '@/features/admin/sellers/sellers.routes';
import ordersRoutes from '@/features/admin/orders/orders.routes';
import supportAdminRoutes from '@/features/admin/support/support.routes';
import buyersRoutes from '@/features/admin/buyers/buyers.routes';
import financeRoutes from '@/features/admin/finance/finance.routes';
import returnsRoutes from '@/features/admin/returns/returns.routes';

export default async function adminRoutes(fastify: FastifyInstance) {
  await fastify.register(profileRoutes, { prefix: '/profile' });
  await fastify.register(adminsRoutes, { prefix: '/admins' });
  await fastify.register(auditRoutes, { prefix: '/audit-logs' });
  await fastify.register(paymentAuditRoutes, { prefix: '/payment-audit-logs' });
  await fastify.register(categoriesAdminRoutes, { prefix: '/categories' });
  await fastify.register(rolesRoutes, { prefix: '/roles' });
  await fastify.register(sellersRoutes, { prefix: '/sellers' });
  await fastify.register(ordersRoutes, { prefix: '/orders' });
  await fastify.register(supportAdminRoutes, { prefix: '/support' });
  await fastify.register(buyersRoutes, { prefix: '/buyers' });
  await fastify.register(financeRoutes, { prefix: '/finance' });
  await fastify.register(returnsRoutes, { prefix: '/returns' });
}
