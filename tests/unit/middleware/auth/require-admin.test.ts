import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { PERMISSIONS } from '@/domain/auth/access/admin/permission-keys';

const mockGetAdminContext = vi.fn();

vi.mock('@/domain/auth/queries/admin-context', () => ({
  getAdminContext: (...args: unknown[]) => mockGetAdminContext(...args),
}));

import {
  requireAdmin,
  requirePermission,
  requireOwner,
} from '@/middleware/auth/require-admin';

const adminId = '550e8400-e29b-41d4-a716-446655440000';

const createReply = () => {
  const reply = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
  };

  return reply as unknown as FastifyReply & { statusCode: number; body: unknown };
};

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auth yoksa 401 döner', async () => {
    const request = { auth: undefined } as FastifyRequest;
    const reply = createReply();

    await requireAdmin(request, reply);

    expect(reply.statusCode).toBe(401);
  });

  it('admin olmayan rol için 403 döner', async () => {
    const request = { auth: { userId: adminId, role: 'buyer' } } as FastifyRequest;
    const reply = createReply();

    await requireAdmin(request, reply);

    expect(reply.statusCode).toBe(403);
    expect(reply.body).toEqual({ message: 'Bu işlem için admin yetkisi gerekli' });
  });

  it('admin context bulunamazsa 403 döner', async () => {
    mockGetAdminContext.mockResolvedValue(null);

    const request = { auth: { userId: adminId, role: 'admin' } } as FastifyRequest;
    const reply = createReply();

    await requireAdmin(request, reply);

    expect(reply.statusCode).toBe(403);
    expect(reply.body).toEqual({ message: 'Admin profili bulunamadı' });
  });

  it('geçerli admin için adminContext set eder', async () => {
    const adminContext = {
      userId: adminId,
      roleId: '660e8400-e29b-41d4-a716-446655440000',
      roleSlug: 'owner',
      roleName: 'Owner',
      permissions: new Set(Object.values(PERMISSIONS)),
      isOwner: true,
    };
    mockGetAdminContext.mockResolvedValue(adminContext);

    const request = { auth: { userId: adminId, role: 'admin' } } as FastifyRequest;
    const reply = createReply();

    await requireAdmin(request, reply);

    expect(request.adminContext).toEqual(adminContext);
    expect(reply.body).toBeUndefined();
  });
});

describe('requirePermission', () => {
  it('owner admin için yetki kontrolü atlanır', async () => {
    const request = {
      adminContext: {
        userId: adminId,
        isOwner: true,
        permissions: new Set<string>(),
      },
    } as unknown as FastifyRequest;
    const reply = createReply();

    await requirePermission(PERMISSIONS.SELLERS_APPROVE)(request, reply);

    expect(reply.statusCode).toBe(200);
  });

  it('yetkisiz admin için 403 döner', async () => {
    const request = {
      adminContext: {
        userId: adminId,
        isOwner: false,
        permissions: new Set([PERMISSIONS.CATEGORIES_READ]),
      },
    } as unknown as FastifyRequest;
    const reply = createReply();

    await requirePermission(PERMISSIONS.SELLERS_APPROVE)(request, reply);

    expect(reply.statusCode).toBe(403);
    expect(reply.body).toEqual({ message: 'Bu işlem için yetkin yok' });
  });
});

describe('requireOwner', () => {
  it('owner olmayan admin için 403 döner', async () => {
    const request = {
      adminContext: {
        userId: adminId,
        isOwner: false,
        permissions: new Set(Object.values(PERMISSIONS)),
      },
    } as unknown as FastifyRequest;
    const reply = createReply();

    await requireOwner(request, reply);

    expect(reply.statusCode).toBe(403);
    expect(reply.body).toEqual({ message: 'Bu işlem için owner yetkisi gerekli' });
  });
});
