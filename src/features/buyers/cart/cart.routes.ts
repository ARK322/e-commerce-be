import { FastifyInstance } from 'fastify';
import { validateBody } from '@/middleware/validation/validate-body';
import { handleRouteError } from '@/shared/errors/handle-route-error';
import { productIdParamSchema } from '@/shared/validation/param-schemas';
import { buyerOnly, buyerWithParams } from '@/middleware/presets/buyer-route-guards';
import {
  addToCartSchema,
  type AddToCartInput,
} from '@/features/buyers/cart/add-to-cart.schema';
import {
  updateCartItemSchema,
  type UpdateCartItemInput,
} from '@/features/buyers/cart/update-cart-item.schema';
import {
  addToCart,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from '@/features/buyers/cart/cart.service';

const buyerWithProductId = buyerWithParams(productIdParamSchema);

export default async function cartRoutes(fastify: FastifyInstance) {
  fastify.get('/', buyerOnly, async (req, reply) => {
    try {
      const cart = await getCart(req.auth!.userId);
      return reply.status(200).send({ cart });
    } catch (error) {
      return handleRouteError(reply, error, 'Sepet alınırken bir hata oluştu');
    }
  });

  fastify.post(
    '/items',
    { preHandler: [...buyerOnly.preHandler, validateBody(addToCartSchema)] },
    async (req, reply) => {
      try {
        const cart = await addToCart(req.auth!.userId, req.body as AddToCartInput);

        return reply.status(200).send({
          message: 'Ürün sepete eklendi',
          cart,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Sepet işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.patch(
    '/items/:productId',
    {
      preHandler: [...buyerWithProductId.preHandler, validateBody(updateCartItemSchema)],
    },
    async (req, reply) => {
      try {
        const { productId } = req.params as { productId: string };
        const { quantity } = req.body as UpdateCartItemInput;
        const cart = await updateCartItem(req.auth!.userId, productId, quantity);

        return reply.status(200).send({
          message: 'Sepet güncellendi',
          cart,
        });
      } catch (error) {
        return handleRouteError(reply, error, 'Sepet işlemi sırasında bir hata oluştu');
      }
    }
  );

  fastify.delete('/items/:productId', buyerWithProductId, async (req, reply) => {
    try {
      const { productId } = req.params as { productId: string };
      const cart = await removeCartItem(req.auth!.userId, productId);

      return reply.status(200).send({
        message: 'Ürün sepetten kaldırıldı',
        cart,
      });
    } catch (error) {
      return handleRouteError(reply, error, 'Sepet işlemi sırasında bir hata oluştu');
    }
  });

  fastify.delete('/', buyerOnly, async (req, reply) => {
    try {
      const cart = await clearCart(req.auth!.userId);

      return reply.status(200).send({
        message: 'Sepet temizlendi',
        cart,
      });
    } catch (error) {
      return handleRouteError(reply, error, 'Sepet işlemi sırasında bir hata oluştu');
    }
  });
}
