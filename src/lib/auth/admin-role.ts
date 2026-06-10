import { Admin } from '../../db';
import type { AdminRole } from '../../db/auth/admin.model';

export const getAdminRole = async (userId: string): Promise<AdminRole | null> => {
  const admin = await Admin.findOne({ userId }).select('adminRole').lean();
  return admin?.adminRole ?? null;
};
