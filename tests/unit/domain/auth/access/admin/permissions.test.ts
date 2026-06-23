import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@/domain/auth/access/admin/permission-keys';
import type { AdminAccessContext } from '@/domain/auth/queries/admin-context';
import {
  canCreateAdmin,
  canDeleteAdmin,
  canManageSellerApproval,
  canUpdateAdminProfile,
  canUpdateAdminRoleId,
  canViewAdmin,
  hasPermission,
} from '@/domain/auth/access/admin/permissions';

const ownerId = '550e8400-e29b-41d4-a716-446655440000';
const otherId = '550e8400-e29b-41d4-a716-446655440001';

const ownerCtx: AdminAccessContext = {
  userId: ownerId,
  roleId: 'role-owner',
  roleSlug: 'owner',
  roleName: 'Owner',
  permissions: new Set(Object.values(PERMISSIONS)),
  isOwner: true,
};

const limitedCtx: AdminAccessContext = {
  userId: otherId,
  roleId: 'role-limited',
  roleSlug: 'limited',
  roleName: 'Limited',
  permissions: new Set([PERMISSIONS.SELLERS_READ]),
  isOwner: false,
};

describe('hasPermission', () => {
  it('owner tüm yetkilere sahiptir', () => {
    expect(hasPermission(ownerCtx, PERMISSIONS.ADMINS_DELETE)).toBe(true);
  });

  it('custom rol sadece atanmış yetkilere sahiptir', () => {
    expect(hasPermission(limitedCtx, PERMISSIONS.SELLERS_READ)).toBe(true);
    expect(hasPermission(limitedCtx, PERMISSIONS.SELLERS_APPROVE)).toBe(false);
  });
});

describe('canCreateAdmin', () => {
  it('sadece owner admin oluşturabilir', () => {
    expect(canCreateAdmin(ownerCtx)).toBe(true);
    expect(canCreateAdmin(limitedCtx)).toBe(false);
  });
});

describe('canDeleteAdmin', () => {
  it('sadece owner admin silebilir', () => {
    expect(canDeleteAdmin(ownerCtx)).toBe(true);
    expect(canDeleteAdmin(limitedCtx)).toBe(false);
  });
});

describe('canManageSellerApproval', () => {
  it('sellers.approve yetkisi gerekir', () => {
    const moderatorCtx: AdminAccessContext = {
      ...limitedCtx,
      permissions: new Set([PERMISSIONS.SELLERS_APPROVE]),
    };

    expect(canManageSellerApproval(ownerCtx)).toBe(true);
    expect(canManageSellerApproval(moderatorCtx)).toBe(true);
    expect(canManageSellerApproval(limitedCtx)).toBe(false);
  });
});

describe('canViewAdmin', () => {
  it('her admin kendi profilini görebilir', () => {
    expect(canViewAdmin(limitedCtx, otherId, otherId)).toBe(true);
  });

  it('admins.read olmadan başka admin görülemez', () => {
    expect(canViewAdmin(ownerCtx, ownerId, otherId)).toBe(true);
    expect(canViewAdmin(limitedCtx, otherId, ownerId)).toBe(false);
  });
});

describe('canUpdateAdminRoleId', () => {
  it('kimse kendi rolünü değiştiremez', () => {
    expect(canUpdateAdminRoleId(ownerCtx, ownerId, ownerId)).toBe(false);
  });

  it('sadece owner başka adminin rolünü değiştirebilir', () => {
    expect(canUpdateAdminRoleId(ownerCtx, ownerId, otherId)).toBe(true);
    expect(canUpdateAdminRoleId(limitedCtx, otherId, ownerId)).toBe(false);
  });
});

describe('canUpdateAdminProfile', () => {
  it('her admin kendi profilini güncelleyebilir', () => {
    expect(canUpdateAdminProfile(limitedCtx, otherId, otherId)).toBe(true);
  });

  it('admins.write olmadan başka admin profili güncellenemez', () => {
    expect(canUpdateAdminProfile(ownerCtx, ownerId, otherId)).toBe(true);
    expect(canUpdateAdminProfile(limitedCtx, otherId, ownerId)).toBe(false);
  });
});
