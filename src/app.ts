import { connectDB } from './db';
import { buildApp } from './app/build-app';

const getServerConfig = () => {
  const host = process.env.HOST;
  const port = Number(process.env.PORT);

  if (!host) {
    throw new Error('HOST tanımlanmamış');
  }

  if (!process.env.PORT || Number.isNaN(port)) {
    throw new Error('PORT tanımlanmamış veya geçersiz');
  }

  return { host, port };
};

const start = async () => {
  try {
    await connectDB();
    console.log('✅ Veritabanı bağlantısı başarılı!');

    const app = await buildApp();
    const { host, port } = getServerConfig();

    await app.listen({ port, host });
    console.log(`🚀 Sunucu ${host}:${port} üzerinde çalışıyor`);
  } catch (err) {
    console.error('❌ Başlatma hatası:', err);
    process.exit(1);
  }
};

start();
