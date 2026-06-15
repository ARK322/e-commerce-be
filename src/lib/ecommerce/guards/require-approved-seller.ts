import { FastifyReply, FastifyRequest } from 'fastify';
import type { SellerPermissionKey } from '@/features/auth/seller/access/permission-keys';
import { hasSellerPermission } from '@/features/auth/seller/access/permissions';
import {
  getSellerContext,
  type SellerAccessContext,
} from '@/features/auth/core/queries/seller-context';

declare module 'fastify' {
  interface FastifyRequest {
    sellerContext?: SellerAccessContext;
  }
}

export const requireApprovedSeller = async (request: FastifyRequest, reply: FastifyReply) => {
  if (!request.auth) {
    return reply.status(401).send({ message: 'Giriş gerekli' });
  }

  if (request.auth.role !== 'seller') {
    return reply.status(403).send({ message: 'Bu işlem için satıcı hesabı gerekli' });
  }

  const sellerContext = await getSellerContext(request.auth.userId);

  if (!sellerContext) {
    return reply.status(403).send({ message: 'Satıcı profili bulunamadı' });
  }

  if (sellerContext.approvalStatus !== 'approved') {
    return reply.status(403).send({ message: 'Onaylı satıcı hesabı gerekli' });
  }

  request.sellerContext = sellerContext;
};

export const requireSellerContext = async (request: FastifyRequest, reply: FastifyReply) => {
  if (!request.auth) {
    return reply.status(401).send({ message: 'Giriş gerekli' });
  }

  if (request.auth.role !== 'seller') {
    return reply.status(403).send({ message: 'Bu işlem için satıcı hesabı gerekli' });
  }

  const sellerContext = await getSellerContext(request.auth.userId);

  if (!sellerContext) {
    return reply.status(403).send({ message: 'Satıcı profili bulunamadı' });
  }

  request.sellerContext = sellerContext;
};

export const requireSellerPermission =
  (...permissions: SellerPermissionKey[]) =>
  async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.sellerContext) {
      return reply.status(403).send({ message: 'Satıcı profili bulunamadı' });
    }

    const allowed = permissions.some((permission) =>
      hasSellerPermission(request.sellerContext!, permission)
    );

    if (!allowed) {
      return reply.status(403).send({ message: 'Bu işlem için yetkin yok' });
    }
  };

export const requireSellerOwner = async (request: FastifyRequest, reply: FastifyReply) => {
  if (!request.sellerContext) {
    return reply.status(403).send({ message: 'Satıcı profili bulunamadı' });
  }

  if (!request.sellerContext.isOwner) {
    return reply.status(403).send({ message: 'Bu işlem için şirket sahibi yetkisi gerekli' });
  }
};

export const requireKurumsalSeller = async (request: FastifyRequest, reply: FastifyReply) => {
  if (!request.sellerContext) {
    return reply.status(403).send({ message: 'Satıcı profili bulunamadı' });
  }

  if (!request.sellerContext.teamManagementEnabled) {
    return reply
      .status(403)
      .send({ message: 'Ekip yönetimi yalnızca kurumsal (Ltd/A.Ş.) satıcılar için geçerlidir' });
  }
};
