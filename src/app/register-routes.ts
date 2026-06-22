import type { FastifyInstance } from 'fastify';
import { registerAuthRoutes } from '@/app/register-auth-routes';
import { registerHealthRoutes } from '@/app/health.routes';
import catalogRoutes from '@/api/public/catalog/catalog.routes';
import buyersRoutes from '@/api/buyer/buyers.routes';
import { getServiceRole, type ServiceRole } from '@/config/service-role';

/** Public catalog (categories, products) route grubu. */
export const registerPublicCatalogRoutes = async (app: FastifyInstance): Promise<void> => {
  await app.register(catalogRoutes);
};

/** Buyer commerce (cart, orders, payments, support) route grubu. */
export const registerBuyerCommerceRoutes = async (app: FastifyInstance): Promise<void> => {
  await app.register(buyersRoutes);
};

/**
 * Process rol\u00fcne g\u00f6re route mount eder.
 * - monolith / api: t\u00fcm gruplar (mevcut davran\u0131\u015f)
 * - catalog: sadece public catalog
 * - identity: /auth scope (identity + admin + seller panel)
 * - commerce / payments: buyer commerce grubu
 *
 * NOT: /auth scope hen\u00fcz identity/admin/seller'a tam b\u00f6l\u00fcnmedi; commerce ve
 * payments ayn\u0131 buyer bundle'\u0131n\u0131 payla\u015f\u0131yor. \u0130nce b\u00f6l\u00fcnme Faz 3-4 kalan i\u015fi.
 */
export const registerRoutes = async (
  app: FastifyInstance,
  role: ServiceRole = getServiceRole()
): Promise<void> => {
  await registerHealthRoutes(app);

  switch (role) {
    case 'catalog':
      await registerPublicCatalogRoutes(app);
      return;
    case 'identity':
      await registerAuthRoutes(app);
      return;
    case 'commerce':
    case 'payments':
      await registerBuyerCommerceRoutes(app);
      return;
    case 'monolith':
    case 'api':
    default:
      await registerAuthRoutes(app);
      await registerPublicCatalogRoutes(app);
      await registerBuyerCommerceRoutes(app);
      return;
  }
};
