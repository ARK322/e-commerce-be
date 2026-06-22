import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '@/domain/auth/access/admin/permission-keys';
import type { AdminAccessContext } from '@/domain/auth/queries/admin-context';

const mockAdminFindById = vi.fn();
const mockUserFindById = vi.fn();
const mockUpdateAdminById = vi.fn();
const mockGetRoleSummariesByIds = vi.fn();

vi.mock('@/repositories/auth/admin.repository', () => ({
  findAdminById: (...args: unknown[]) => mockAdminFindById(...args),
  updateAdminById: (...args: unknown[]) => mockUpdateAdminById(...args),
}));

vi.mock('@/repositories/auth/user.repository', () => ({
  findUserById: (...args: unknown[]) => mockUserFindById(...args),
}));

vi.mock('@/domain/auth/access/admin/role-queries', () => ({
  getRoleSummariesByIds: (...args: unknown[]) => mockGetRoleSummariesByIds(...args),
}));

vi.mock('@/domain/auth/admin/admin-audit', () => ({
  recordAdminAction: vi.fn().mockResolvedValue(undefined),
}));

import { updateAdminProfile } from '@/features/admin/profile/profile.service';

const ownerId = '550e8400-e29b-41d4-a716-446655440000';
const limitedId = '550e8400-e29b-41d4-a716-446655440001';
const limitedRoleId = '660e8400-e29b-41d4-a716-446655440001';

const ownerCtx: AdminAccessContext = {
  userId: ownerId,
  roleId: '660e8400-e29b-41d4-a716-446655440000',
  roleSlug: 'owner',
  roleName: 'Owner',
  permissions: new Set(Object.values(PERMISSIONS)),
  isOwner: true,
};

const limitedCtx: AdminAccessContext = {
  userId: limitedId,
  roleId: limitedRoleId,
  roleSlug: 'limited',
  roleName: 'Limited',
  permissions: new Set([PERMISSIONS.SELLERS_READ]),
  isOwner: false,
};

const limitedAdmin = {
  _id: limitedId,
  roleId: limitedRoleId,
  firstName: null,
  lastName: null,
  phone: null,
};

const limitedUser = {
  email: 'limited@example.com',
  role: 'admin',
  isEmailVerified: true,
  createdAt: new Date(),
};

describe('updateAdminProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminFindById.mockResolvedValue(limitedAdmin);
    mockUserFindById.mockResolvedValue(limitedUser);
    mockUpdateAdminById.mockResolvedValue({
      ...limitedAdmin,
      firstName: 'Ali',
      lastName: 'Veli',
    });
    mockGetRoleSummariesByIds.mockResolvedValue(
      new Map([
        [
          limitedRoleId,
          { roleId: limitedRoleId, name: 'Limited', slug: 'limited' },
        ],
      ])
    );
  });

  it('admin kendi profilini güncelleyebilir', async () => {
    const result = await updateAdminProfile(limitedCtx, limitedId, limitedId, {
      firstName: 'Ali',
      lastName: 'Veli',
    });

    expect(result.profile.firstName).toBe('Ali');
    expect(mockUpdateAdminById).toHaveBeenCalled();
  });

  it('owner başka admin profilini güncelleyebilir', async () => {
    await updateAdminProfile(ownerCtx, ownerId, limitedId, { firstName: 'Ali' });

    expect(mockUpdateAdminById).toHaveBeenCalledWith(
      limitedId,
      { $set: { firstName: 'Ali' } },
      { returnDocument: 'after' }
    );
  });

  it('admins.write olmadan başka admin profili güncellenemez', async () => {
    await expect(
      updateAdminProfile(limitedCtx, limitedId, ownerId, { firstName: 'Ali' })
    ).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(mockUpdateAdminById).not.toHaveBeenCalled();
  });
});
