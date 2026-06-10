import mongoose from 'mongoose';
import dotenv from 'dotenv';

if (!process.env.RAILWAY_ENVIRONMENT) {
  dotenv.config();
}

const getMongoUri = () =>
  process.env.MONGO_URI ||
  process.env.MONGO_URL ||
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL;

export const connectDB = async () => {
  try {
    const mongoUri = getMongoUri();

    if (!mongoUri) {
      throw new Error(
        'MongoDB bağlantı adresi bulunamadı. Railway Variables\'a MONGO_URI ekle (veya MONGO_URL / MONGODB_URI / DATABASE_URL).'
      );
    }

    await mongoose.connect(mongoUri);

    console.log("🚀 MongoDB'ye başarıyla bağlandı!");
  } catch (error) {
    console.error('❌ Veritabanı bağlantı hatası:', error);
    process.exit(1);
  }
};
