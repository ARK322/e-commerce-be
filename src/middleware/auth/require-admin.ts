import { FastifyReply, FastifyRequest } from 'fastify';
import type { PermissionKey } from '@/domain/auth/access/admin/permission-keys';
import { hasPermission } from '@/domain/auth/access/admin/permissions';
import { getAdminContext, type AdminAccessContext } from '@/domain/auth/queries/admin-context';

declare module 'fastify' {
  interface FastifyRequest {
    adminContext?: AdminAccessContext;
  }
}

export const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
  if (!request.auth) {
    return reply.status(401).send({ message: 'Giriş gerekli' });
  }

  if (request.auth.role !== 'admin') {
    return reply.status(403).send({ message: 'Bu işlem için admin yetkisi gerekli' });
  }

  const adminContext = await getAdminContext(request.auth.userId);

  if (!adminContext) {
    return reply.status(403).send({ message: 'Admin profili bulunamadı' });
  }

  request.adminContext = adminContext;
};

export const requirePermission =
  (...permissions: PermissionKey[]) =>
  async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.adminContext) {
      return reply.status(403).send({ message: 'Admin profili bulunamadı' });
    }

    if (request.adminContext.isOwner) {
      return;
    }

    const allowed = permissions.some((permission) =>
      hasPermission(request.adminContext!, permission)
    );

    if (!allowed) {
      return reply.status(403).send({ message: 'Bu işlem için yetkin yok' });
    }
  };

export const requireAllPermissions =
  (...permissions: PermissionKey[]) =>
  async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.adminContext) {
      return reply.status(403).send({ message: 'Admin profili bulunamadı' });
    }

    if (request.adminContext.isOwner) {
      return;
    }

    const allowed = permissions.every((permission) =>
      hasPermission(request.adminContext!, permission)
    );

    if (!allowed) {
      return reply.status(403).send({ message: 'Bu işlem için yetkin yok' });
    }
  };

export const requireOwner = async (request: FastifyRequest, reply: FastifyReply) => {
  if (!request.adminContext) {
    return reply.status(403).send({ message: 'Admin profili bulunamadı' });
  }

  if (!request.adminContext.isOwner) {
    return reply.status(403).send({ message: 'Bu işlem için owner yetkisi gerekli' });
  }
};
