import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';

const mockGetSellerContext = vi.fn();

vi.mock('@/domain/auth/queries/seller-context', () => ({
  getSellerContext: (...args: unknown[]) => mockGetSellerContext(...args),
}));

import { requireApprovedSeller } from '@/middleware/sellers/require-approved-seller';

const userId = '550e8400-e29b-41d4-a716-446655440000';
const companyId = '660e8400-e29b-41d4-a716-446655440000';

const approvedContext = {
  userId,
  companyId,
  companyName: 'Test A.Ş.',
  sellerType: 'kurumsal' as const,
  approvalStatus: 'approved' as const,
  roleId: '770e8400-e29b-41d4-a716-446655440000',
  roleSlug: 'owner',
  roleName: 'Owner',
  permissions: new Set<string>(),
  isOwner: true,
  teamManagementEnabled: true,
  member: { firstName: null, lastName: null, phone: null },
};

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

describe('requireApprovedSeller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auth yoksa 401 döner', async () => {
    const request = {} as FastifyRequest;
    const reply = createReply();

    await requireApprovedSeller(request, reply);

    expect(reply.statusCode).toBe(401);
    expect(reply.body).toEqual({ message: 'Giriş gerekli' });
  });

  it('seller değilse 403 döner', async () => {
    const request = {
      auth: { userId, role: 'buyer' },
    } as FastifyRequest;
    const reply = createReply();

    await requireApprovedSeller(request, reply);

    expect(reply.statusCode).toBe(403);
    expect(reply.body).toEqual({ message: 'Bu işlem için satıcı hesabı gerekli' });
  });

  it('satıcı profili yoksa 403 döner', async () => {
    mockGetSellerContext.mockResolvedValue(null);

    const request = {
      auth: { userId, role: 'seller' },
    } as FastifyRequest;
    const reply = createReply();

    await requireApprovedSeller(request, reply);

    expect(reply.statusCode).toBe(403);
    expect(reply.body).toEqual({ message: 'Satıcı profili bulunamadı' });
  });

  it('onaylanmamış satıcı için 403 döner', async () => {
    mockGetSellerContext.mockResolvedValue({
      ...approvedContext,
      approvalStatus: 'pending',
    });

    const request = {
      auth: { userId, role: 'seller' },
    } as FastifyRequest;
    const reply = createReply();

    await requireApprovedSeller(request, reply);

    expect(reply.statusCode).toBe(403);
    expect(reply.body).toEqual({ message: 'Onaylı satıcı hesabı gerekli' });
  });

  it('onaylı satıcı için geçer', async () => {
    mockGetSellerContext.mockResolvedValue(approvedContext);

    const request = {
      auth: { userId, role: 'seller' },
    } as FastifyRequest;
    const reply = createReply();

    await requireApprovedSeller(request, reply);

    expect(reply.statusCode).toBe(200);
    expect(request.sellerContext).toEqual(approvedContext);
  });
});
