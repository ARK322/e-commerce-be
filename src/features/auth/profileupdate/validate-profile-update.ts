import { FastifyReply, FastifyRequest } from 'fastify';
import { buyerProfileUpdateSchema } from './schemas/buyer-profile-update.schema';
import { sellerProfileUpdateSchema } from './schemas/seller-profile-update.schema';

export const validateProfileUpdate = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const role = request.auth?.role;

  if (!role) {
    return reply.status(401).send({ message: 'Giriş gerekli' });
  }

  const schema = role === 'buyer' ? buyerProfileUpdateSchema : sellerProfileUpdateSchema;
  const parsed = schema.safeParse(request.body);

  if (!parsed.success) {
    return reply.status(400).send({
      message: 'Geçersiz istek verisi',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  request.body = parsed.data;
};
