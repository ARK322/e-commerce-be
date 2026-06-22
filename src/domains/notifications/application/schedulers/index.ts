import { startOutboxProcessorScheduler } from '@/domains/notifications/application/outbox/process-outbox-events';

export const startNotificationsSchedulers = (): void => {
  startOutboxProcessorScheduler();
};
