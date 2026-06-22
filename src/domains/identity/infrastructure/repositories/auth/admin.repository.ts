import { Admin } from '@/integrations/mongo';

export const findAdminById = async (adminId: string) => Admin.findById(adminId);

export const findAdminByIdLean = async (adminId: string) => Admin.findById(adminId).lean();

export const findAdminRoleIdByUserIdLean = async (adminId: string) =>
  Admin.findById(adminId).select('roleId').lean();

export const listAdminsLean = async () => Admin.find().sort({ createdAt: -1 }).lean();

export const createAdmin = async (data: Record<string, unknown>) => Admin.create(data);

export const updateAdminById = async (
  adminId: string,
  update: Record<string, unknown>,
  options?: { returnDocument?: 'after' | 'before' }
) => Admin.findByIdAndUpdate(adminId, update, options);

export const saveAdminDocument = async (admin: { save: () => Promise<unknown> }) => admin.save();

export const deleteAdminById = async (adminId: string) => Admin.findByIdAndDelete(adminId);

export const countAdminsByRoleId = async (roleId: string) =>
  Admin.countDocuments({ roleId });
