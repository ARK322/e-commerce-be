import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SELLER_PERMISSIONS } from '@/domain/auth/access/seller/permission-keys';

const mockFindSellerApprovalStatusLean = vi.fn();
const mockGetAdminContext = vi.fn();
const mockGetSellerContext = vi.fn();

vi.mock('@/repositories/sellers/seller.repository', () => ({
  findSellerApprovalStatusLean: (...args: unknown[]) => mockFindSellerApprovalStatusLean(...args),
}));

vi.mock('@/domain/auth/queries/admin-context', () => ({
  getAdminContext: (...args: unknown[]) => mockGetAdminContext(...args),
}));

vi.mock('@/domain/auth/queries/seller-context', () => ({
  getSellerContext: (...args: unknown[]) => mockGetSellerContext(...args),
}));

import { buildAuthUserFields } from '@/domain/auth/responses/user.response';

const userId = '550e8400-e29b-41d4-a716-446655440000';
const companyId = '660e8400-e29b-41d4-a716-446655440000';
const roleId = '770e8400-e29b-41d4-a716-446655440000';

describe('buildAuthUserFields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('buyer için isActive döner', async () => {
    const result = await buildAuthUserFields({
      _id: userId,
      role: 'buyer',
      isActive: true,
      isEmailVerified: true,
    });

    expect(result).toEqual({
      userId,
      role: 'buyer',
      isEmailVerified: true,
      isActive: true,
    });
  });

  it('seller için şirket ve yetki bilgisi döner', async () => {
    mockGetSellerContext.mockResolvedValue({
      userId,
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
      member: { firstName: 'Ali', lastName: null, phone: null },
    });

    const result = await buildAuthUserFields({
      _id: userId,
      role: 'seller',
      isEmailVerified: true,
    });

    expect(result).toEqual({
      userId,
      role: 'seller',
      isEmailVerified: true,
      companyId,
      companyName: 'Test A.Ş.',
      sellerType: 'kurumsal',
      approvalStatus: 'approved',
      teamManagementEnabled: true,
      roleId,
      roleSlug: 'owner',
      roleName: 'Owner',
      permissions: Object.values(SELLER_PERMISSIONS),
      isOwner: true,
      member: { firstName: 'Ali', lastName: null, phone: null },
    });
  });

  it('seller member yoksa legacy fallback döner', async () => {
    mockGetSellerContext.mockResolvedValue(null);
    mockFindSellerApprovalStatusLean.mockResolvedValue({ approvalStatus: 'draft' });

    const result = await buildAuthUserFields({
      _id: userId,
      role: 'seller',
      isEmailVerified: true,
    });

    expect(result).toMatchObject({
      companyId: userId,
      approvalStatus: 'draft',
      isOwner: true,
    });
  });

  it('admin için rol ve yetki bilgisi döner', async () => {
    mockGetAdminContext.mockResolvedValue({
      userId,
      roleId,
      roleSlug: 'owner',
      roleName: 'Owner',
      permissions: new Set(['admins.read']),
      isOwner: true,
    });

    const result = await buildAuthUserFields({
      _id: userId,
      role: 'admin',
      isEmailVerified: true,
    });

    expect(result).toMatchObject({
      role: 'admin',
      roleSlug: 'owner',
      isOwner: true,
    });
  });

  it('admin profili yoksa 403 döner', async () => {
    mockGetAdminContext.mockResolvedValue(null);

    await expect(
      buildAuthUserFields({
        _id: userId,
        role: 'admin',
        isEmailVerified: true,
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Admin profili bulunamadı',
    });
  });
});
