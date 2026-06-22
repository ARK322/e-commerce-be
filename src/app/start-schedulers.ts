import { startIdentitySchedulers } from '@/domains/identity/application/schedulers';
import { startCommerceSchedulers } from '@/domains/commerce/application/schedulers';
import { startPaymentsSchedulers } from '@/domains/payments/application/schedulers';
import { startNotificationsSchedulers } from '@/domains/notifications/application/schedulers';
import { getServiceRole, type ServiceRole } from '@/config/service-role';

/** Tüm domain scheduler'larını başlatır (monolith modu). */
export const startDomainSchedulers = (): void => {
  startIdentitySchedulers();
  startCommerceSchedulers();
  startPaymentsSchedulers();
  startNotificationsSchedulers();
};

/**
 * Process rolüne göre scheduler sahipliği. Faz 1+ ayrı worker pod'larında
 * scheduler'lar çift çalışmasın diye her rol kendi setini başlatır.
 */
export const startSchedulersForRole = (role: ServiceRole = getServiceRole()): void => {
  switch (role) {
    case 'monolith':
      startDomainSchedulers();
      return;
    case 'identity':
      startIdentitySchedulers();
      return;
    case 'commerce':
      startCommerceSchedulers();
      return;
    case 'payments-worker':
      startPaymentsSchedulers();
      return;
    case 'notification-worker':
      startNotificationsSchedulers();
      return;
    case 'api':
    case 'catalog':
    case 'payments':
      // HTTP serving roller scheduler çalıştırmaz — worker pod'ları sahiplenir.
      return;
    default:
      return;
  }
};
