import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SELLER_PERMISSIONS } from '@/domain/auth/access/seller/permission-keys';
import type { SellerAccessContext } from '@/domain/auth/queries/seller-context';
import { AuthError } from '@/domain/auth/errors';

const mockListSellerMembersByCompanyIdLean = vi.fn();
const mockFindSellerMemberByCompanyAndUserId = vi.fn();
const mockFindUserByIdLean = vi.fn();
const mockFindUsersByIdsLean = vi.fn();
const mockGetSellerRoleSummariesByIds = vi.fn();

vi.mock('@/repositories/sellers/seller-member.repository', () => ({
  findSellerMemberByCompanyAndUserId: (...args: unknown[]) =>
    mockFindSellerMemberByCompanyAndUserId(...args),
  listSellerMembersByCompanyIdLean: (...args: unknown[]) =>
    mockListSellerMembersByCompanyIdLean(...args),
}));

vi.mock('@/repositories/auth/user.repository', () => ({
  findUserByIdLean: (...args: unknown[]) => mockFindUserByIdLean(...args),
  findUsersByIdsLean: (...args: unknown[]) => mockFindUsersByIdsLean(...args),
}));

vi.mock('@/domain/auth/access/seller/role-queries', () => ({
  getSellerRoleSummariesByIds: (...args: unknown[]) => mockGetSellerRoleSummariesByIds(...args),
}));

import { getSellerMemberByUserId, listSellerMembers } from '@/features/sellers/members/members.service';

const companyId = '660e8400-e29b-41d4-a716-446655440000';
const memberId = '550e8400-e29b-41d4-a716-446655440000';
const roleId = '770e8400-e29b-41d4-a716-446655440000';

const ownerCtx: SellerAccessContext = {
  userId: memberId,
  companyId,
  companyName: 'Test A.Ş.',
  sellerType: 'kurumsal',
  approvalStatus: 'approved',
  roleId,
  roleSlug: 'owner',
  roleName: 'Owner',
  permissions: new Set(Object.values(SELLER_PERMISSIONS)),
  isOwner: true,
  teamManagementEnabled: true,
  member: { firstName: null, lastName: null, phone: null },
};

const limitedCtx: SellerAccessContext = {
  ...ownerCtx,
  permissions: new Set([SELLER_PERMISSIONS.PRODUCTS_READ]),
  isOwner: false,
};

describe('listSellerMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('yetkisiz satıcı için AuthError fırlatır', async () => {
    await expect(listSellerMembers(limitedCtx)).rejects.toThrow(AuthError);
    await expect(listSellerMembers(limitedCtx)).rejects.toThrow(/Ekip listesini görüntüleme yetkin yok/);
  });

  it('yetkili satıcı ekip üyelerini listeler', async () => {
    mockListSellerMembersByCompanyIdLean.mockResolvedValue([
      {
        _id: memberId,
        sellerId: companyId,
        roleId,
        isOwner: true,
        firstName: 'Ali',
        lastName: 'Veli',
        phone: null,
        createdAt: new Date('2024-01-01'),
      },
    ]);
    mockFindUsersByIdsLean.mockResolvedValue([
      {
        _id: memberId,
        email: 'ali@test.com',
        isEmailVerified: true,
        createdAt: new Date('2024-01-01'),
      },
    ]);
    mockGetSellerRoleSummariesByIds.mockResolvedValue(
      new Map([[roleId, { roleId, name: 'Owner', slug: 'owner' }]])
    );

    const members = await listSellerMembers(ownerCtx);

    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({
      userId: memberId,
      email: 'ali@test.com',
      companyId,
      isOwner: true,
      profile: { firstName: 'Ali', lastName: 'Veli', phone: null },
    });
    expect(mockListSellerMembersByCompanyIdLean).toHaveBeenCalledWith(companyId);
  });
});

describe('getSellerMemberByUserId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('yetkisiz satıcı için AuthError fırlatır', async () => {
    await expect(getSellerMemberByUserId(limitedCtx, '660e8400-e29b-41d4-a716-446655440000')).rejects.toThrow(
      AuthError
    );
  });

  it('yetkili satıcı çalışan detayını döner', async () => {
    mockFindSellerMemberByCompanyAndUserId.mockResolvedValue({
      _id: memberId,
      sellerId: companyId,
      roleId,
      isOwner: true,
      firstName: 'Ali',
      lastName: 'Veli',
      phone: null,
    });
    mockFindUserByIdLean.mockResolvedValue({
      _id: memberId,
      email: 'ali@test.com',
      role: 'seller',
      isEmailVerified: true,
    });
    mockGetSellerRoleSummariesByIds.mockResolvedValue(
      new Map([[roleId, { roleId, name: 'Owner', slug: 'owner' }]])
    );

    const member = await getSellerMemberByUserId(ownerCtx, memberId);

    expect(member).toMatchObject({
      userId: memberId,
      email: 'ali@test.com',
      isOwner: true,
    });
  });
});
