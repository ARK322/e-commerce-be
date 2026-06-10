import dotenv from 'dotenv';
import { connectDB, Admin, User } from '../db';
import { hashPassword } from '../lib/common/password';

dotenv.config();

const seedOwner = async () => {
  const email = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD;

  if (!email || !password) {
    throw new Error('SEED_OWNER_EMAIL ve SEED_OWNER_PASSWORD .env dosyasında tanımlanmalı');
  }

  await connectDB();

  const existingOwner = await Admin.findOne({ adminRole: 'owner' }).lean();

  if (existingOwner) {
    console.log('ℹ️ Owner admin zaten mevcut, seed atlandı.');
    process.exit(0);
  }

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    const hasAdminProfile = await Admin.findOne({ userId: existingUser._id });

    if (hasAdminProfile) {
      console.log('ℹ️ Bu e-posta için admin profili zaten var, seed atlandı.');
      process.exit(0);
    }

    throw new Error('Bu e-posta kayıtlı ama admin profili yok. Farklı e-posta kullan veya DB\'yi kontrol et.');
  }

  const hashedPassword = await hashPassword(password);
  const user = await User.create({
    email,
    password: hashedPassword,
    role: 'admin',
    isActive: true,
    isEmailVerified: true,
  });

  await Admin.create({
    userId: user._id,
    adminRole: 'owner',
    createdBy: null,
  });

  console.log(`✅ Owner admin oluşturuldu: ${email}`);
  process.exit(0);
};

seedOwner().catch((error) => {
  console.error('❌ Seed hatası:', error);
  process.exit(1);
});
