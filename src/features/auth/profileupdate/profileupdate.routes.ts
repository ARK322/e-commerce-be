import { FastifyInstance, FastifyReply } from 'fastify';
import { requireAuth } from '../../../lib/common/middleware/require-auth';
import { requireEmailVerified } from '../../../lib/auth/middleware/require-email-verified';
import { RegisterError } from '../register/register.errors';
import { getProfile, updateProfile } from './profileupdate.service';
import type { BuyerProfileUpdateInput, SellerProfileUpdateInput } from './schemas';
import { validateProfileUpdate } from './validate-profile-update';

const handleProfileError = (reply: FastifyReply, error: unknown) => {
  if (error instanceof RegisterError) {
    return reply.status(error.statusCode).send({ message: error.message });
  }

  return reply.status(500).send({ message: 'Profil işlemi sırasında bir hata oluştu' });
};

export default async function (fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [requireAuth, requireEmailVerified] }, async (req, reply) => {
    try {
      const result = await getProfile(req.auth!);
      return reply.status(200).send(result);
    } catch (error) {
      return handleProfileError(reply, error);
    }
  });

  fastify.patch(
    '/',
    { preHandler: [requireAuth, requireEmailVerified, validateProfileUpdate] },
    async (req, reply) => {
      try {
        const result = await updateProfile(
          req.auth!,
          req.body as BuyerProfileUpdateInput | SellerProfileUpdateInput
        );

        if (req.auth!.role === 'seller') {
          const sellerResult = result as Awaited<
            ReturnType<typeof updateProfile>
          > & { approvalStatus: string };

          return reply.status(200).send({
            message: 'Profil güncellendi',
            approvalStatus: sellerResult.approvalStatus,
            profile: sellerResult.profile,
          });
        }

        const buyerResult = result as { profile: unknown; isActive: boolean };

        return reply.status(200).send({
          message: 'Profil güncellendi',
          isActive: buyerResult.isActive,
          profile: buyerResult.profile,
        });
      } catch (error) {
        return handleProfileError(reply, error);
      }
    }
  );
}
