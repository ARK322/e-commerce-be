import { connectDB } from '@/integrations/mongo';
import { validateEnvAtStartup } from '@/config/env';
import { logger } from '@/shared/logging';
import { startNotificationsSchedulers } from '@/domains/notifications/application/schedulers';

/**
 * Bağımsız bildirim worker'ı (HTTP serve etmez).
 * Outbox event'lerini drain eder ve e-postaları gönderir.
 *
 * Çalıştırma: SERVICE_ROLE=notification-worker node dist/app/notification-worker.js
 * Monolith modunda bu süreç ayrıca başlatılmaz; scheduler API pod'unda çalışır.
 */
let shutdownHooksRegistered = false;

const registerProcessHandlers = (): void => {
  if (shutdownHooksRegistered) {
    return;
  }

  shutdownHooksRegistered = true;

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Notification worker kapanış sinyali aldı');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Notification worker: yakalanmamış promise rejection');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Notification worker: yakalanmamış exception');
    process.exit(1);
  });
};

export const startNotificationWorker = async (): Promise<void> => {
  try {
    validateEnvAtStartup();
    await connectDB();
    logger.info('Notification worker: MongoDB bağlantısı başarılı');

    startNotificationsSchedulers();
    registerProcessHandlers();

    logger.info('Notification worker çalışıyor — outbox drain aktif');
  } catch (err) {
    logger.error({ err }, 'Notification worker başlatma hatası');
    process.exit(1);
  }
};

if (require.main === module) {
  void startNotificationWorker();
}
