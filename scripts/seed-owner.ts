import dotenv from 'dotenv';
import mongoose from 'mongoose';

import { connectDB } from '@/infrastructure/mongo/connection';
import { Admin, User } from '@/infrastructure/mongo';
import { ensureSystemOwnerRole } from '@/domain/auth/access/admin/system-roles';
import { findUserByEmail } from '@/repositories/auth/user.repository';
import { findAdminById } from '@/repositories/auth/admin.repository';
import { createUserId } from '@/shared/ids';
import { hashPassword } from '@/shared/security';

dotenv.config();

const requireEnv = (key: string): string => {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`${key} tanımlı olmalı (.env veya Railway Variables)`);
  }

  return value;
};

const run = async () => {
  const email = requireEnv('SEED_OWNER_EMAIL').toLowerCase();
  const password = requireEnv('SEED_OWNER_PASSWORD');

  await connectDB();

  const ownerRole = await ensureSystemOwnerRole();
  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    const existingAdmin = await findAdminById(String(existingUser._id));

    if (!existingAdmin) {
      throw new Error(`${email} kullanıcısı var ama admin profili yok`);
    }

    if (String(existingAdmin.roleId) !== String(ownerRole._id)) {
      throw new Error(`${email} admin ama owner rolünde değil`);
    }

    console.log(`Owner admin zaten mevcut: ${email}`);
    return;
  }

  const adminId = createUserId();
  const passwordHash = await hashPassword(password);

  await User.create({
    _id: adminId,
    email,
    password: passwordHash,
    role: 'admin',
    isActive: true,
    isEmailVerified: true,
  });

  await Admin.create({
    _id: adminId,
    roleId: String(ownerRole._id),
    firstName: 'Owner',
    lastName: 'Admin',
  });

  console.log(`Owner admin oluşturuldu: ${email}`);
};

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
