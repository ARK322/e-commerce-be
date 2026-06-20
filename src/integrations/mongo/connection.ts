import mongoose from 'mongoose';
import { env } from '@/config/env';
import { logger } from '@/internal/common/logging';
import { redactMongoUri } from '@/internal/common/security/redact-uri';

export const connectDB = async (): Promise<void> => {
  const mongoUri = env.mongoUri;

  if (!mongoUri) {
    throw new Error(
      "MongoDB bağlantı adresi bulunamadı. Railway Variables'a MONGO_URI ekle (veya MONGO_URL / MONGODB_URI / DATABASE_URL)."
    );
  }

  try {
    await mongoose.connect(mongoUri);
  } catch (error) {
    logger.error(
      { err: error, mongoUri: redactMongoUri(mongoUri) },
      'Veritabanı bağlantı hatası'
    );
    throw error;
  }
};
