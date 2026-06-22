import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '@/domains/identity/application/access/admin/permission-keys';
import type { AdminAccessContext } from '@/domains/identity/application/queries/admin-context';
import { AuthError } from '@/domains/identity/application/errors';

const mockAdminRoleFind = vi.fn();

vi.mock('@/integrations/mongo', () => ({
  AdminRole: {
    find: (...args: unknown[]) => mockAdminRoleFind(...args),
  },
}));

import { listAdminRoles } from '@/api/admin/roles/roles.service';

const ownerCtx: AdminAccessContext = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  roleId: '660e8400-e29b-41d4-a716-446655440000',
  roleSlug: 'owner',
  roleName: 'Owner',
  permissions: new Set(Object.values(PERMISSIONS)),
  isOwner: true,
};

const limitedCtx: AdminAccessContext = {
  userId: '550e8400-e29b-41d4-a716-446655440001',
  roleId: '660e8400-e29b-41d4-a716-446655440001',
  roleSlug: 'limited',
  roleName: 'Limited',
  permissions: new Set([PERMISSIONS.ADMINS_READ]),
  isOwner: false,
};

describe('listAdminRoles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('yetkisiz admin için AuthError fırlatır', async () => {
    await expect(listAdminRoles(limitedCtx)).rejects.toThrow(AuthError);
    await expect(listAdminRoles(limitedCtx)).rejects.toThrow(/Rol listesini görüntüleme yetkin yok/);
  });

  it('owner admin rolleri listeler', async () => {
    mockAdminRoleFind.mockReturnValue({
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

    const roles = await listAdminRoles(ownerCtx);

    expect(roles).toHaveLength(1);
    expect(roles[0]).toMatchObject({ name: 'Owner', slug: 'owner', isSystem: true });
  });
});
