import type { FastifyInstance } from 'fastify';
import { requireAuth } from '@/middleware/auth/require-auth';
import { requireEmailVerified } from '@/middleware/auth/require-email-verified';
import {
  requireApprovedSeller,
  requireSellerPermission,
} from '@/middleware/sellers/require-approved-seller';
import { validateBody } from '@/middleware/validation/validate-body';
import { validateParams } from '@/middleware/validation/validate-params';
import { validateQuery } from '@/middleware/validation/validate-query';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { SELLER_PERMISSIONS } from '@/domain/auth/access/seller/permission-keys';
import { ticketIdParamSchema } from '@/shared/validation/param-schemas';
import {
  createSupportTicketSchema,
  postSupportMessageSchema,
  type CreateSupportTicketInput,
  type PostSupportMessageInput,
} from '@/features/support/support.schemas';
import {
  listSupportMessagesQuerySchema,
  listSupportTicketsQuerySchema,
  type ListSupportMessagesQuery,
  type ListSupportTicketsQuery,
} from '@/features/support/support-query.schemas';
import {
  createSellerSupportTicket,
  getSellerSupportTicket,
  listSellerSupportMessages,
  listSellerSupportTickets,
  postSellerSupportMessage,
} from '@/features/support/ticket.service';

const sellerSupportRead = {
  preHandler: [
    requireAuth,
    requireEmailVerified,
    requireApprovedSeller,
    requireSellerPermission(SELLER_PERMISSIONS.ORDERS_READ),
  ],
};

const sellerWithTicketId = {
  preHandler: [...sellerSupportRead.preHandler, validateParams(ticketIdParamSchema)],
};

export default async function sellerSupportRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    {
      preHandler: [...sellerSupportRead.preHandler, validateQuery(listSupportTicketsQuerySchema)],
    },
    async (req, reply) => {
      try {
        const result = await listSellerSupportTickets(
          req.sellerContext!.companyId,
          req.query as ListSupportTicketsQuery
        );
        return reply.status(200).send(result);
      } catch (error) {
        return handleRouteError(reply, error, 'Destek talepleri alınırken bir hata oluştu');
      }
    }
  );

  fastify.post(
    '/',
    {
      preHandler: [...sellerSupportRead.preHandler, validateBody(createSupportTicketSchema)],
    },
    async (req, reply) => {
      try {
        const result = await createSellerSupportTicket(
          req.sellerContext!.companyId,
          req.body as CreateSupportTicketInput
        );

        return reply.status(201).send({
          message: 'Destek talebi oluşturuldu',
          ...result,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Destek talebi oluşturulurken bir hata oluştu');
      }
    }
  );

  fastify.get('/:ticketId', sellerWithTicketId, async (req, reply) => {
    try {
      const { ticketId } = req.params as { ticketId: string };
      const result = await getSellerSupportTicket(req.sellerContext!.companyId, ticketId);
      return reply.status(200).send(result);
    } catch (error) {
      return handleRouteError(reply, error, 'Destek talebi alınırken bir hata oluştu');
    }
  });

  fastify.get(
    '/:ticketId/messages',
    {
      preHandler: [
        ...sellerWithTicketId.preHandler,
        validateQuery(listSupportMessagesQuerySchema),
      ],
    },
    async (req, reply) => {
      try {
        const { ticketId } = req.params as { ticketId: string };
        const result = await listSellerSupportMessages(
          req.sellerContext!.companyId,
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
        ...sellerWithTicketId.preHandler,
        validateBody(postSupportMessageSchema),
      ],
    },
    async (req, reply) => {
      try {
        const { ticketId } = req.params as { ticketId: string };
        const result = await postSellerSupportMessage(
          req.sellerContext!.companyId,
          ticketId,
          req.body as PostSupportMessageInput
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
}
