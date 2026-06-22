import { FastifyInstance } from 'fastify';
import { registerProfileDocumentMultipart } from '@/plugins/multipart/profile';
import { requireAuth } from '@/middleware/auth/require-auth';
import { requireEmailVerified } from '@/middleware/auth/require-email-verified';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import {
  buyerProfileUpdateSchema,
  sellerProfileUpdateSchema,
  type BuyerProfileUpdateInput,
  type SellerProfileUpdateInput,
} from '@/features/buyers/profile/profile.schema';
import { getProfile, updateProfile } from '@/features/buyers/profile/profile.service';
import { validateBodyByRole } from '@/middleware/validation/validate-body-by-role';

const validateProfileUpdate = validateBodyByRole({
  schemas: {
    buyer: buyerProfileUpdateSchema,
    seller: sellerProfileUpdateSchema,
  },
  rejectAdmin: true,
});

export default async function profileRoutes(fastify: FastifyInstance) {
  await registerProfileDocumentMultipart(fastify);

  fastify.get('/', { preHandler: [requireAuth, requireEmailVerified] }, async (req, reply) => {
    try {
      const result = await getProfile(req.auth!);
      return reply.status(200).send(result);
    } catch (error) {
      return handleRouteError(reply, error, 'Profil işlemi sırasında bir hata oluştu');
    }
  });

  fastify.patch(
    '/',
    { preHandler: [requireAuth, requireEmailVerified, validateProfileUpdate] },
    async (req, reply) => {
      try {
        await updateProfile(
          req.auth!,
          req.body as BuyerProfileUpdateInput | SellerProfileUpdateInput
        );

        const profile = await getProfile(req.auth!);

        return reply.status(200).send({
          message: 'Profil güncellendi',
          ...profile,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Profil işlemi sırasında bir hata oluştu');
      }
    }
  );
}
