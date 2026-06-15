import { describe, expect, it } from 'vitest';
import {
  BIREYSEL_SELLER_PERMISSIONS,
  SELLER_PERMISSIONS,
} from '@/features/auth/seller/access/permission-keys';
import type { SellerAccessContext } from '@/features/auth/core/queries/seller-context';
import {
  canWriteProducts,
  hasSellerPermission,
} from '@/features/auth/seller/access/permissions';

const bireyselCtx: SellerAccessContext = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  companyId: '660e8400-e29b-41d4-a716-446655440000',
  companyName: 'Test Şahıs',
  sellerType: 'bireysel',
  approvalStatus: 'approved',
  roleId: '',
  roleSlug: 'owner',
  roleName: 'Owner',
  permissions: new Set(BIREYSEL_SELLER_PERMISSIONS),
  isOwner: true,
  teamManagementEnabled: false,
  member: { firstName: null, lastName: null, phone: null },
};

const kurumsalOwnerCtx: SellerAccessContext = {
  ...bireyselCtx,
  sellerType: 'kurumsal',
  teamManagementEnabled: true,
  permissions: new Set(Object.values(SELLER_PERMISSIONS)),
  roleId: '770e8400-e29b-41d4-a716-446655440000',
};

describe('hasSellerPermission', () => {
  it('kurumsal owner tüm yetkilere sahiptir', () => {
    expect(hasSellerPermission(kurumsalOwnerCtx, SELLER_PERMISSIONS.MEMBERS_DELETE)).toBe(true);
  });

  it('custom rol sadece atanmış yetkilere sahiptir', () => {
    const limitedCtx: SellerAccessContext = {
      ...kurumsalOwnerCtx,
      isOwner: false,
      permissions: new Set([SELLER_PERMISSIONS.PRODUCTS_READ]),
    };

    expect(canWriteProducts(limitedCtx)).toBe(false);
    expect(hasSellerPermission(limitedCtx, SELLER_PERMISSIONS.PRODUCTS_READ)).toBe(true);
  });

  it('bireysel satıcı ekip yetkilerine sahip değildir', () => {
    expect(hasSellerPermission(bireyselCtx, SELLER_PERMISSIONS.MEMBERS_WRITE)).toBe(false);
    expect(hasSellerPermission(bireyselCtx, SELLER_PERMISSIONS.PRODUCTS_WRITE)).toBe(true);
    expect(bireyselCtx.teamManagementEnabled).toBe(false);
  });
});
