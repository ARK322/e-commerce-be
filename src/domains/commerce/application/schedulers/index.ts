import { startPendingOrderExpiryScheduler } from '@/domains/commerce/application/orders/expire-pending-orders';

export const startCommerceSchedulers = (): void => {
  startPendingOrderExpiryScheduler();
};
