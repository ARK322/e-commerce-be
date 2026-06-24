import { FastifyInstance } from 'fastify';
import { requireAuth } from '@/middleware/auth/require-auth';
import { requireEmailVerified } from '@/middleware/auth/require-email-verified';
import { validateBody } from '@/middleware/validation/validate-body';
import { validateParams } from '@/middleware/validation/validate-params';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { z } from 'zod';
import {
  buyerAddressBodySchema,
  buyerAddressUpdateSchema,
  type BuyerAddressBody,
} from '@/features/buyers/profile/addresses.schema';
import {
  addBuyerAddress,
  deleteBuyerAddress,
  listBuyerAddresses,
  updateBuyerAddress,
} from '@/features/buyers/profile/addresses.service';

const addressIdParamSchema = z.object({
  addressId: z.string().uuid(),
});

const buyerAddressGuard = {
  preHandler: [requireAuth, requireEmailVerified],
};

export default async function addressesRoutes(fastify: FastifyInstance) {
  fastify.get('/', buyerAddressGuard, async (req, reply) => {
    try {
      const addresses = await listBuyerAddresses(req.auth!.userId);
      return reply.status(200).send({ addresses });
    } catch (error) {
      return handleRouteError(reply, error, 'Adresler alınırken bir hata oluştu');
    }
  });

  fastify.post(
    '/',
    { preHandler: [...buyerAddressGuard.preHandler, validateBody(buyerAddressBodySchema)] },
    async (req, reply) => {
      try {
        const address = await addBuyerAddress(req.auth!.userId, req.body as BuyerAddressBody);

        return reply.status(201).send({
          message: 'Adres eklendi',
          address,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Adres eklenirken bir hata oluştu');
      }
    }
  );

  fastify.patch(
    '/:addressId',
    {
      preHandler: [
        ...buyerAddressGuard.preHandler,
        validateParams(addressIdParamSchema),
        validateBody(buyerAddressUpdateSchema),
      ],
    },
    async (req, reply) => {
      try {
        const { addressId } = req.params as { addressId: string };
        const address = await updateBuyerAddress(
          req.auth!.userId,
          addressId,
          req.body as Partial<BuyerAddressBody>
        );

        return reply.status(200).send({
          message: 'Adres güncellendi',
          address,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Adres güncellenirken bir hata oluştu');
      }
    }
  );

  fastify.delete(
    '/:addressId',
    {
      preHandler: [...buyerAddressGuard.preHandler, validateParams(addressIdParamSchema)],
    },
    async (req, reply) => {
      try {
        const { addressId } = req.params as { addressId: string };
        await deleteBuyerAddress(req.auth!.userId, addressId);

        return reply.status(200).send({ message: 'Adres silindi' });
      } catch (error) {
        return handleRouteError(reply, error, 'Adres silinirken bir hata oluştu');
      }
    }
  );
}
