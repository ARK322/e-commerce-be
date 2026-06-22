import { AdminRole } from '@/integrations/mongo';

export const findAdminRoleById = async (roleId: string) => AdminRole.findById(roleId);

export const findAdminRoleByIdLean = async (roleId: string) => AdminRole.findById(roleId).lean();

export const findAdminRoleBySlugLean = async (slug: string) =>
  AdminRole.findOne({ slug }).lean();

export const findAdminRoleBySlug = async (slug: string) => AdminRole.findOne({ slug });

export const listAdminRolesLean = async () =>
  AdminRole.find().sort({ isSystem: -1, name: 1 }).lean();

export const listAssignableAdminRolesLean = async (excludeSlug: string) =>
  AdminRole.find({ slug: { $ne: excludeSlug } })
    .sort({ name: 1 })
    .select('name slug description permissions isSystem')
    .lean();

export const findAdminRolesByIdsLean = async (roleIds: string[], select = 'name slug') =>
  AdminRole.find({ _id: { $in: roleIds } })
    .select(select)
    .lean();

export const createAdminRole = async (data: Record<string, unknown>) => AdminRole.create(data);

export const saveAdminRoleDocument = async (role: { save: () => Promise<unknown> }) => role.save();

export const deleteAdminRoleById = async (roleId: string) => AdminRole.findByIdAndDelete(roleId);
