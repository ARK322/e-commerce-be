import { findBuyerPaymentProfileLean } from '@/repositories/buyers/buyer.repository';
import { findOrderByIdLean } from '@/repositories/buyers/order.repository';
import { createLogger } from '@/internal/common/logging';
import {
  enqueueOutboxEvent,
  OUTBOX_EVENT_TYPES,
} from '@/internal/common/outbox/enqueue-outbox-event';
import { sendOrderConfirmationEmail } from '@/internal/buyers/orders/mail/send-order-confirmation';

const log = createLogger({ module: 'order-confirmation' });

export const enqueueOrderConfirmationEmail = async (orderId: string): Promise<void> => {
  const order = await findOrderByIdLean(orderId);

  if (!order || order.status !== 'paid') {
    return;
  }

  try {
    const { user } = await findBuyerPaymentProfileLean(String(order.buyerId));
    const email = user?.email ? String(user.email) : null;

    if (!email) {
      return;
    }

    try {
      await sendOrderConfirmationEmail(email, orderId, order.totalAmount, order.currency);
    } catch (error) {
      log.warn({ err: error, orderId }, 'Sipariş onay e-postası gönderilemedi — outbox kuyruğuna alınıyor');
      await enqueueOutboxEvent(OUTBOX_EVENT_TYPES.EMAIL_ORDER_CONFIRMATION, {
        email,
        orderId,
        totalAmount: order.totalAmount,
        currency: order.currency,
      });
    }
  } catch (error) {
    log.error({ err: error, orderId }, 'Sipariş onay e-postası hazırlanamadı');
  }
};
