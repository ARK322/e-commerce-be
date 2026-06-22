import type { FastifyInstance } from 'fastify';
import { buyerOnly, buyerWithParams } from '@/middleware/presets/buyer-route-guards';
import { validateBody } from '@/middleware/validation/validate-body';
import { validateQuery } from '@/middleware/validation/validate-query';
import { handleRouteError } from '@/shared/errors/handle-route-error';
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
  createBuyerSupportTicket,
  getBuyerSupportTicket,
  listBuyerSupportMessages,
  listBuyerSupportTickets,
  postBuyerSupportMessage,
} from '@/features/support/ticket.service';

const buyerWithTicketId = buyerWithParams(ticketIdParamSchema);

export default async function buyerSupportRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    {
      preHandler: [...buyerOnly.preHandler, validateQuery(listSupportTicketsQuerySchema)],
    },
    async (req, reply) => {
      try {
        const result = await listBuyerSupportTickets(
          req.auth!.userId,
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
      preHandler: [...buyerOnly.preHandler, validateBody(createSupportTicketSchema)],
    },
    async (req, reply) => {
      try {
        const result = await createBuyerSupportTicket(
          req.auth!.userId,
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

  fastify.get('/:ticketId', buyerWithTicketId, async (req, reply) => {
    try {
      const { ticketId } = req.params as { ticketId: string };
      const result = await getBuyerSupportTicket(req.auth!.userId, ticketId);
      return reply.status(200).send(result);
    } catch (error) {
      return handleRouteError(reply, error, 'Destek talebi alınırken bir hata oluştu');
    }
  });

  fastify.get(
    '/:ticketId/messages',
    {
      preHandler: [
        ...buyerWithTicketId.preHandler,
        validateQuery(listSupportMessagesQuerySchema),
      ],
    },
    async (req, reply) => {
      try {
        const { ticketId } = req.params as { ticketId: string };
        const result = await listBuyerSupportMessages(
          req.auth!.userId,
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
        ...buyerWithTicketId.preHandler,
        validateBody(postSupportMessageSchema),
      ],
    },
    async (req, reply) => {
      try {
        const { ticketId } = req.params as { ticketId: string };
        const result = await postBuyerSupportMessage(
          req.auth!.userId,
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
