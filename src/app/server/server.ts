import { connectDB } from '@/db';
import { buildApp } from '@/app/server/build-app';
import { logger } from '@/lib/common/logger';

export const getPort = (): number => {
  const port = process.env.PORT ? Number(process.env.PORT) : 8080;

  if (Number.isNaN(port)) {
    throw new Error('PORT geçersiz bir sayı');
  }

  return port;
};

export const start = async (): Promise<void> => {
  try {
    await connectDB();
    logger.info('MongoDB bağlantısı başarılı');

    const app = await buildApp();
    const port = getPort();

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
