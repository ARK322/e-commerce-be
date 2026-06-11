import { connectDB } from './db';
import { buildApp } from './app/build-app';

const getPort = () => {
  // Eğer process.env.PORT varsa onu sayıya çevir, yoksa lokalde çalışabilmesi için varsayılan 8080 yap
  const port = process.env.PORT ? Number(process.env.PORT) : 8080;

  if (Number.isNaN(port)) {
    throw new Error('PORT geçersiz bir sayı');
  }

  return port;
};

const start = async () => {
  try {
    await connectDB();
    console.log('✅ Veritabanı bağlantısı başarılı!');

    const app = await buildApp();
    const port = getPort();

    // Host artık kesinlikle 0.0.0.0, port ise Railway ne verdiyse o.
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Sunucu 0.0.0.0:${port} üzerinde çalışıyor`);
  } catch (err) {
    console.error('❌ Başlatma hatası:', err);
    process.exit(1);
  }
};

start();