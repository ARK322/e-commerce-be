import type { FastifyInstance } from 'fastify';
import { connectDB } from '@/integrations/mongo';
import { buildApp } from '@/app/app';
import { env, validateEnvAtStartup } from '@/config/env';
import { logger } from '@/internal/common/logging';
import { startPendingOrderExpiryScheduler } from '@/internal/buyers/orders/expire-pending-orders';
import { startPaymentReconciliationScheduler } from '@/internal/buyers/orders/reconcile-payments';

export const getPort = (): number => env.port;

let shutdownHooksRegistered = false;

const registerProcessHandlers = (closeApp: () => Promise<void>): void => {
  if (shutdownHooksRegistered) {
    return;
  }

  shutdownHooksRegistered = true;

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Kapanış sinyali alındı');
    try {
      await closeApp();
    } catch (err) {
      logger.error({ err }, 'Kapanış sırasında hata');
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Yakalanmamış promise rejection');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Yakalanmamış exception');
    process.exit(1);
  });
};

export const start = async (): Promise<void> => {
  try {
    validateEnvAtStartup();
    await connectDB();
    logger.info('MongoDB bağlantısı başarılı');

    startPendingOrderExpiryScheduler();
    startPaymentReconciliationScheduler();

    const app = await buildApp();
    const port = getPort();

    registerProcessHandlers(async () => {
      await app.close();
      logger.info('Sunucu kapatıldı');
    });

    await app.listen({ port, host: '0.0.0.0' });
    logger.info({ port, host: '0.0.0.0' }, 'Sunucu çalışıyor');
  } catch (err) {
    logger.error({ err }, 'Başlatma hatası');
    process.exit(1);
  }
};

if (require.main === module) {
  void start();
}
