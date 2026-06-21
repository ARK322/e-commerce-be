import { FastifyInstance } from 'fastify';
import adminsRoutes from '@/features/admin/admins/admins.routes';
import auditRoutes from '@/features/admin/audit/audit.routes';
import categoriesAdminRoutes from '@/features/admin/categories/categories.routes';
import paymentAuditRoutes from '@/features/admin/payment-audit/payment-audit.routes';
import profileRoutes from '@/features/admin/profile/profile.routes';
import rolesRoutes from '@/features/admin/roles/roles.routes';
import sellersRoutes from '@/features/admin/sellers/sellers.routes';

export default async function adminRoutes(fastify: FastifyInstance) {
  await fastify.register(profileRoutes, { prefix: '/profile' });
  await fastify.register(adminsRoutes, { prefix: '/admins' });
  await fastify.register(auditRoutes, { prefix: '/audit-logs' });
  await fastify.register(paymentAuditRoutes, { prefix: '/payment-audit-logs' });
  await fastify.register(categoriesAdminRoutes, { prefix: '/categories' });
  await fastify.register(rolesRoutes, { prefix: '/roles' });
  await fastify.register(sellersRoutes, { prefix: '/sellers' });
}
