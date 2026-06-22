import { FastifyInstance } from 'fastify';
import adminsRoutes from '@/api/admin/admins/admins.routes';
import auditRoutes from '@/api/admin/audit/audit.routes';
import categoriesAdminRoutes from '@/api/admin/categories/categories.routes';
import paymentAuditRoutes from '@/api/admin/payment-audit/payment-audit.routes';
import profileRoutes from '@/api/admin/profile/profile.routes';
import rolesRoutes from '@/api/admin/roles/roles.routes';
import sellersRoutes from '@/api/admin/sellers/sellers.routes';
import ordersRoutes from '@/api/admin/orders/orders.routes';
import supportAdminRoutes from '@/api/admin/support/support.routes';

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
}
