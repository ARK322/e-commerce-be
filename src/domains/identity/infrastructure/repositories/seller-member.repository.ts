import { SellerMember } from '@/integrations/mongo';

export const findSellerMemberById = async (memberId: string) => SellerMember.findById(memberId);

export const findSellerMemberByIdLean = async (memberId: string) =>
  SellerMember.findById(memberId).lean();

export const findSellerMemberByCompanyAndUserId = async (
  companyId: string,
  userId: string
) => SellerMember.findOne({ _id: userId, sellerId: companyId });

export const listSellerMembersByCompanyIdLean = async (companyId: string) =>
  SellerMember.find({ sellerId: companyId }).sort({ isOwner: -1, createdAt: -1 }).lean();

export const createSellerMember = async (data: Record<string, unknown>) => SellerMember.create(data);

export const updateSellerMemberById = async (
  memberId: string,
  update: Record<string, unknown>,
  options?: { returnDocument?: 'after' | 'before' }
) => SellerMember.findByIdAndUpdate(memberId, update, options);

export const saveSellerMemberDocument = async (member: { save: () => Promise<unknown> }) =>
  member.save();

export const deleteSellerMemberById = async (memberId: string) =>
  SellerMember.findByIdAndDelete(memberId);

export const deleteSellerMembersBySellerId = async (sellerId: string) =>
  SellerMember.deleteMany({ sellerId });

export const countOwnerSellerMembersByCompanyId = async (companyId: string) =>
  SellerMember.countDocuments({ sellerId: companyId, isOwner: true });

export const countSellerMembersByCompanyAndRoleId = async (companyId: string, roleId: string) =>
  SellerMember.countDocuments({ sellerId: companyId, roleId });
