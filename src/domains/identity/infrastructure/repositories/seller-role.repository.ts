import { SellerRole } from '@/integrations/mongo';

export const findSellerRoleByIdLean = async (roleId: string) => SellerRole.findById(roleId).lean();

export const findSellerRoleBySlugAndCompanyId = async (companyId: string, slug: string) =>
  SellerRole.findOne({ sellerId: companyId, slug });

export const findSellerRoleBySlugAndCompanyIdLean = async (companyId: string, slug: string) =>
  SellerRole.findOne({ sellerId: companyId, slug }).lean();

export const findSellerRoleByIdAndCompanyId = async (companyId: string, roleId: string) =>
  SellerRole.findOne({ _id: roleId, sellerId: companyId });

export const findSellerRoleByIdAndCompanyIdLean = async (companyId: string, roleId: string) =>
  SellerRole.findOne({ _id: roleId, sellerId: companyId }).lean();

export const findSellerRoleSlugByIdAndCompanyIdLean = async (companyId: string, roleId: string) =>
  SellerRole.findOne({ _id: roleId, sellerId: companyId }).select('slug isSystem').lean();

export const listSellerRolesByCompanyIdLean = async (companyId: string) =>
  SellerRole.find({ sellerId: companyId }).sort({ isSystem: -1, name: 1 }).lean();

export const listAssignableSellerRolesByCompanyIdLean = async (
  companyId: string,
  excludeSlug: string
) =>
  SellerRole.find({
    sellerId: companyId,
    slug: { $ne: excludeSlug },
  })
    .sort({ name: 1 })
    .select('name slug description permissions isSystem')
    .lean();

export const findSellerRolesByIdsAndCompanyIdLean = async (
  companyId: string,
  roleIds: string[],
  select = 'name slug'
) =>
  SellerRole.find({
    _id: { $in: roleIds },
    sellerId: companyId,
  })
    .select(select)
    .lean();

export const createSellerRole = async (data: Record<string, unknown>) => SellerRole.create(data);

export const saveSellerRoleDocument = async (role: { save: () => Promise<unknown> }) => role.save();

export const deleteSellerRoleById = async (roleId: string) => SellerRole.findByIdAndDelete(roleId);

export const deleteSellerRolesBySellerId = async (sellerId: string) =>
  SellerRole.deleteMany({ sellerId });
