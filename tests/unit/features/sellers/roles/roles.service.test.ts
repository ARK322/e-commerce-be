import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SELLER_PERMISSIONS } from '@/domains/identity/application/access/seller/permission-keys';
import type { SellerAccessContext } from '@/domains/identity/application/queries/seller-context';
import { AuthError } from '@/domains/identity/application/errors';

const mockSellerRoleFind = vi.fn();

vi.mock('@/integrations/mongo', () => ({
  SellerRole: {
    find: (...args: unknown[]) => mockSellerRoleFind(...args),
  },
  SELLER_SYSTEM_OWNER_ROLE_SLUG: 'owner',
}));

import { listSellerRoles } from '@/api/seller/roles/roles.service';

const ownerCtx: SellerAccessContext = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  companyId: '660e8400-e29b-41d4-a716-446655440000',
  companyName: 'Test A.Ş.',
  sellerType: 'kurumsal',
  approvalStatus: 'approved',
  roleId: '770e8400-e29b-41d4-a716-446655440000',
  roleSlug: 'owner',
  roleName: 'Owner',
  permissions: new Set(Object.values(SELLER_PERMISSIONS)),
  isOwner: true,
  teamManagementEnabled: true,
  member: { firstName: null, lastName: null, phone: null },
};

const limitedCtx: SellerAccessContext = {
  ...ownerCtx,
  userId: '550e8400-e29b-41d4-a716-446655440001',
  permissions: new Set([SELLER_PERMISSIONS.PRODUCTS_READ]),
  isOwner: false,
};

describe('listSellerRoles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('yetkisiz satıcı için AuthError fırlatır', async () => {
    await expect(listSellerRoles(limitedCtx)).rejects.toThrow(AuthError);
    await expect(listSellerRoles(limitedCtx)).rejects.toThrow(/Rol listesini görüntüleme yetkin yok/);
  });

  it('owner satıcı rolleri listeler', async () => {
    mockSellerRoleFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: 'role-1',
            name: 'Owner',
            slug: 'owner',
            permissions: [],
            isSystem: true,
          },
        ]),
      }),
    });

    const roles = await listSellerRoles(ownerCtx);

    expect(roles).toHaveLength(1);
    expect(roles[0]).toMatchObject({ name: 'Owner', slug: 'owner' });
    expect(mockSellerRoleFind).toHaveBeenCalledWith({ sellerId: ownerCtx.companyId });
  });
});
