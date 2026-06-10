import { connectDB } from './db';
import { buildApp } from './app/build-app';

const start = async () => {
  try {
    await connectDB();
    console.log('✅ Veritabanı bağlantısı başarılı!');

    const app = await buildApp();

    const port = Number(process.env.PORT) || 3000;
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Sunucu port ${port} üzerinde çalışıyor`);
  } catch (err) {
    console.error('❌ Başlatma hatası:', err);
    process.exit(1);
  }
};

start();
