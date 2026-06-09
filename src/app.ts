import fastify from 'fastify';
import cors from '@fastify/cors';
import { connectDB } from './lib/db';
import authRoutes from './features/auth/auth.routes';

const app = fastify();

const start = async () => {
  try {
    await connectDB();
    console.log('✅ Veritabanı bağlantısı başarılı!');

    await app.register(cors, { origin: true });

    await app.register(authRoutes, { prefix: '/auth' });

    const port = Number(process.env.PORT) || 3000;
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Sunucu port ${port} üzerinde çalışıyor`);
  } catch (err) {
    console.error('❌ Başlatma hatası:', err);
    process.exit(1);
  }
};

start();
