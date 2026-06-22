import type { FastifyInstance } from 'fastify';
import { adminOnly } from '@/middleware/presets/admin-route-guards';
import { requirePermission } from '@/middleware/auth/require-admin';
import { validateBody } from '@/middleware/validation/validate-body';
import { validateParams } from '@/middleware/validation/validate-params';
import { validateQuery } from '@/middleware/validation/validate-query';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { PERMISSIONS } from '@/domain/auth/access/admin/permission-keys';
import { ticketIdParamSchema } from '@/shared/validation/param-schemas';
import {
  adminListSupportTicketsQuerySchema,
  type AdminListSupportTicketsQuery,
} from '@/features/admin/support/list-support.schema';
import {
  listSupportMessagesQuerySchema,
  updateSupportTicketSchema,
  type ListSupportMessagesQuery,
  type UpdateSupportTicketInput,
} from '@/features/support/support-query.schemas';
import {
  adminPostSupportMessageSchema,
  type AdminPostSupportMessageInput,
} from '@/features/support/support.schemas';
import {
  getAdminSupportTicket,
  listAdminSupportMessages,
  listAdminSupportTickets,
  postAdminSupportMessage,
  updateAdminSupportTicket,
} from '@/features/support/ticket.service';

const adminWithTicketId = {
  preHandler: [...adminOnly.preHandler, validateParams(ticketIdParamSchema)],
};

export default async function adminSupportRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    {
      preHandler: [
        ...adminOnly.preHandler,
        requirePermission(PERMISSIONS.SUPPORT_READ),
        validateQuery(adminListSupportTicketsQuerySchema),
      ],
    },
    async (req, reply) => {
      try {
        const result = await listAdminSupportTickets(
          req.adminContext!,
          req.query as AdminListSupportTicketsQuery
        );
        return reply.status(200).send(result);
      } catch (error) {
        return handleRouteError(reply, error, 'Destek talepleri alınırken bir hata oluştu');
      }
    }
  );

  fastify.get(
    '/:ticketId',
    {
      preHandler: [...adminWithTicketId.preHandler, requirePermission(PERMISSIONS.SUPPORT_READ)],
    },
    async (req, reply) => {
      try {
        const { ticketId } = req.params as { ticketId: string };
        const result = await getAdminSupportTicket(req.adminContext!, ticketId);
        return reply.status(200).send(result);
      } catch (error) {
        return handleRouteError(reply, error, 'Destek talebi alınırken bir hata oluştu');
      }
    }
  );

  fastify.get(
    '/:ticketId/messages',
    {
      preHandler: [
        ...adminWithTicketId.preHandler,
        requirePermission(PERMISSIONS.SUPPORT_READ),
        validateQuery(listSupportMessagesQuerySchema),
      ],
    },
    async (req, reply) => {
      try {
        const { ticketId } = req.params as { ticketId: string };
        const result = await listAdminSupportMessages(
          req.adminContext!,
          ticketId,
          req.query as ListSupportMessagesQuery
        );
        return reply.status(200).send(result);
      } catch (error) {
        return handleRouteError(reply, error, 'Destek mesajları alınırken bir hata oluştu');
      }
    }
  );

  fastify.post(
    '/:ticketId/messages',
    {
      preHandler: [
        ...adminWithTicketId.preHandler,
        requirePermission(PERMISSIONS.SUPPORT_WRITE),
        validateBody(adminPostSupportMessageSchema),
      ],
    },
    async (req, reply) => {
      try {
        const { ticketId } = req.params as { ticketId: string };
        const result = await postAdminSupportMessage(
          req.adminContext!,
          ticketId,
          req.body as AdminPostSupportMessageInput
        );

        return reply.status(201).send({
          message: 'Mesaj gönderildi',
          supportMessage: result.supportMessage,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Destek mesajı gönderilirken bir hata oluştu');
      }
    }
  );

  fastify.patch(
    '/:ticketId',
    {
      preHandler: [
        ...adminWithTicketId.preHandler,
        requirePermission(PERMISSIONS.SUPPORT_WRITE),
        validateBody(updateSupportTicketSchema),
      ],
    },
    async (req, reply) => {
      try {
        const { ticketId } = req.params as { ticketId: string };
        const result = await updateAdminSupportTicket(
          req.adminContext!,
          ticketId,
          req.body as UpdateSupportTicketInput
        );

        return reply.status(200).send({
          message: 'Destek talebi güncellendi',
          ...result,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Destek talebi güncellenirken bir hata oluştu');
      }
    }
  );
}
