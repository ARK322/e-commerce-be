import { Buyer, Order, Payment, Product, User } from '@/integrations/mongo';
import { createUserId } from '@/internal/common/ids';
import { env } from '@/config/env';
import { findBuyerOrder } from '@/repositories/buyers/order.repository';
import { findOrderIdByCheckoutToken } from '@/repositories/buyers/payment.repository';
import { initializeIyzicoCheckout } from '@/integrations/iyzico/initialize-checkout';
import { completeIyzicoCheckout } from '@/integrations/iyzico/retrieve-checkout';
import { refundIyzicoPayment } from '@/integrations/iyzico/refund-payment';
import { CommerceError } from '@/internal/common/errors/commerce-error';
import { logger } from '@/internal/common/logging';
import type { CreatePaymentInput } from '@/features/buyers/payments/create-payment.schema';
import {
  buildPaymentSplitsForOrder,
  syncPaymentSplitTransactionIds,
} from '@/internal/buyers/payment/payment-split';
import {
  assertProductStockAvailable,
  assertSellersReadyForOrder,
} from '@/internal/buyers/orders/order-item-validation';
import { cancelPendingOrder } from '@/internal/buyers/orders/cancel-pending-order';
import { fulfillPaidOrder } from '@/internal/buyers/orders/fulfill-order';

type PaymentRecord = {
  _id: unknown;
  orderId: string;
  buyerId: string;
  amount: number;
  currency: string;
  provider?: string | null;
  externalId?: string | null;
  status: string;
  createdAt?: Date;
  updatedAt?: Date;
};

type OrderItemRecord = {
  productId: string;
  sellerId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
};

type CreatePaymentOptions = {
  clientIp?: string;
};

const AMOUNT_TOLERANCE = 0.01;

const toPaymentResponse = (payment: PaymentRecord) => ({
  id: String(payment._id),
  orderId: payment.orderId,
  buyerId: payment.buyerId,
  amount: payment.amount,
  currency: payment.currency,
  provider: payment.provider ?? null,
  externalId: payment.externalId ?? null,
  status: payment.status,
  createdAt: payment.createdAt,
  updatedAt: payment.updatedAt,
});

const amountsMatch = (expected: number, actual: number): boolean =>
  Math.abs(expected - actual) <= AMOUNT_TOLERANCE;

const markPaymentCompleted = async (
  payment: {
    status: string;
    provider?: string | null;
    externalId?: string | null;
    updatedAt?: Date;
    save: () => Promise<unknown>;
  },
  externalId: string
) => {
  payment.status = 'completed';
  payment.provider = 'iyzico';
  payment.externalId = externalId;
  payment.updatedAt = new Date();
  await payment.save();
};

const loadBuyerPaymentProfile = async (buyerId: string) => {
  const [user, buyer] = await Promise.all([
    User.findById(buyerId).lean(),
    Buyer.findById(buyerId).lean(),
  ]);

  if (!user?.email) {
    throw new CommerceError(400, 'Ödeme için e-posta bilgisi eksik');
  }

  if (
    !buyer?.firstName ||
    !buyer.lastName ||
    !buyer.phone ||
    !buyer.country ||
    !buyer.city ||
    !buyer.deliveryAddress ||
    !buyer.nationalId
  ) {
    throw new CommerceError(400, 'Ödeme için profil bilgileri eksik (TC kimlik no dahil)');
  }

  return {
    email: user.email,
    firstName: buyer.firstName,
    lastName: buyer.lastName,
    phone: buyer.phone,
    nationalId: buyer.nationalId,
    country: buyer.country,
    city: buyer.city,
    address: buyer.deliveryAddress,
    createdAt: user.createdAt ?? new Date(),
  };
};

const assertOrderReadyForPayment = async (items: OrderItemRecord[]) => {
  await assertSellersReadyForOrder(items);

  for (const item of items) {
    const product = await Product.findOne({
      _id: item.productId,
      isActive: true,
    }).lean();

    if (!product) {
      throw new CommerceError(400, 'Siparişte geçersiz ürün var');
    }

    assertProductStockAvailable(product, item.quantity);
  }
};

export const createPaymentForOrder = async (
  buyerId: string,
  input: CreatePaymentInput,
  options?: CreatePaymentOptions
) => {
  const order = await findBuyerOrder(buyerId, input.orderId);

  if (order.status !== 'pending') {
    throw new CommerceError(400, 'Sipariş ödemeye uygun değil');
  }

  const existingPayment = await Payment.findOne({ orderId: input.orderId });

  if (existingPayment?.status === 'completed') {
    throw new CommerceError(409, 'Bu sipariş için ödeme zaten tamamlandı');
  }

  await assertOrderReadyForPayment(order.items as OrderItemRecord[]);

  const buyerProfile = await loadBuyerPaymentProfile(buyerId);
  const paymentSplits = await buildPaymentSplitsForOrder(input.orderId, order.items);
  const checkout = await initializeIyzicoCheckout({
    orderId: input.orderId,
    buyerId,
    amount: order.totalAmount,
    currency: order.currency,
    clientIp: options?.clientIp ?? '127.0.0.1',
    buyer: buyerProfile,
    items: paymentSplits.map((split) => split.checkoutItem),
  });

  const payment =
    existingPayment ??
    (await Payment.create({
      _id: createUserId(),
      orderId: input.orderId,
      buyerId,
      amount: order.totalAmount,
      currency: order.currency,
      provider: 'iyzico',
      status: 'pending',
    }));

  payment.provider = 'iyzico';
  payment.externalId = checkout.token;
  payment.status = 'pending';
  payment.updatedAt = new Date();
  await payment.save();

  return {
    payment: toPaymentResponse(payment.toObject()),
    checkout,
  };
};

const handleFulfillmentFailure = async (
  payment: {
    _id: unknown;
    orderId: string;
    amount: number;
    status: string;
    provider?: string | null;
    externalId?: string | null;
    updatedAt?: Date;
    save: () => Promise<unknown>;
  },
  externalId: string,
  error: unknown
): Promise<never> => {
  await markPaymentCompleted(payment, externalId);
  await cancelPendingOrder(payment.orderId);

  const refunded = await refundIyzicoPayment(externalId, payment.amount, payment.orderId);

  if (refunded) {
    payment.status = 'refunded';
    payment.updatedAt = new Date();
    await payment.save();
  }

  logger.error(
    { err: error, orderId: payment.orderId, refunded },
    'Ödeme alındı ancak sipariş tamamlanamadı'
  );

  throw error;
};

export const completePaymentFromCheckoutToken = async (token: string) => {
  const result = await completeIyzicoCheckout(token);
  const payment = await Payment.findOne({ orderId: result.orderId });

  if (!payment) {
    throw new CommerceError(404, 'Ödeme kaydı bulunamadı');
  }

  if (result.status === 'failed') {
    payment.status = 'failed';
    payment.updatedAt = new Date();
    await payment.save();
    await cancelPendingOrder(result.orderId);

    return {
      payment: toPaymentResponse(payment.toObject()),
      success: false as const,
      reason: result.reason,
    };
  }

  if (payment.status === 'completed') {
    const order = await Order.findById(result.orderId).lean();

    if (order?.status === 'paid' || order?.status === 'shipped' || order?.status === 'delivered') {
      return {
        payment: toPaymentResponse(payment.toObject()),
        success: true as const,
      };
    }
  }

  const order = await Order.findById(result.orderId).lean();

  if (!order) {
    throw new CommerceError(404, 'Sipariş bulunamadı');
  }

  if (order.status === 'paid' || order.status === 'shipped' || order.status === 'delivered') {
    if (payment.status !== 'completed') {
      await markPaymentCompleted(payment, result.externalId);
    }

    return {
      payment: toPaymentResponse(payment.toObject()),
      success: true as const,
    };
  }

  if (order.status !== 'pending') {
    throw new CommerceError(409, 'Sipariş ödemeye uygun değil');
  }

  if (!amountsMatch(order.totalAmount, result.paidAmount)) {
    logger.error(
      {
        orderId: result.orderId,
        expected: order.totalAmount,
        paid: result.paidAmount,
      },
      'Iyzico ödeme tutarı sipariş tutarıyla uyuşmuyor'
    );
    throw new CommerceError(409, 'Ödeme tutarı sipariş tutarıyla uyuşmuyor');
  }

  try {
    await fulfillPaidOrder(
      result.orderId,
      order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }))
    );
  } catch (error) {
    if (error instanceof CommerceError && error.statusCode === 409) {
      const refreshed = await Order.findById(result.orderId).lean();

      if (
        refreshed?.status === 'paid' ||
        refreshed?.status === 'shipped' ||
        refreshed?.status === 'delivered'
      ) {
        await markPaymentCompleted(payment, result.externalId);

        try {
          await syncPaymentSplitTransactionIds(result.orderId, result.itemTransactions);
        } catch (syncError) {
          logger.error({ err: syncError, orderId: result.orderId }, 'Split transaction sync başarısız');
        }

        return {
          payment: toPaymentResponse(payment.toObject()),
          success: true as const,
        };
      }
    }

    await handleFulfillmentFailure(payment, result.externalId, error);
  }

  await markPaymentCompleted(payment, result.externalId);

  try {
    await syncPaymentSplitTransactionIds(result.orderId, result.itemTransactions);
  } catch (syncError) {
    logger.error({ err: syncError, orderId: result.orderId }, 'Split transaction sync başarısız');
  }

  return {
    payment: toPaymentResponse(payment.toObject()),
    success: true as const,
  };
};

export const getPaymentByOrderId = async (buyerId: string, orderId: string) => {
  await findBuyerOrder(buyerId, orderId);

  const payment = await Payment.findOne({ orderId }).lean();

  if (!payment) {
    throw new CommerceError(404, 'Ödeme kaydı bulunamadı');
  }

  return toPaymentResponse(payment as PaymentRecord);
};

type PaymentCallbackOutcome = 'success' | 'failed';

const parseIyzicoCallbackBody = (body: unknown): Record<string, string> => {
  if (typeof body === 'string') {
    return Object.fromEntries(new URLSearchParams(body));
  }

  if (Buffer.isBuffer(body)) {
    return Object.fromEntries(new URLSearchParams(body.toString('utf8')));
  }

  if (typeof body === 'object' && body !== null) {
    return Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, String(value)])
    );
  }

  return {};
};

export const buildPaymentRedirectUrl = (
  outcome: PaymentCallbackOutcome,
  orderId?: string | null
): string => {
  const frontendUrl = env.frontendUrlOrDefault.replace(/\/+$/, '');

  if (orderId) {
    return `${frontendUrl}/orders/${orderId}?payment=${outcome}`;
  }

  return `${frontendUrl}/checkout?payment=${outcome}`;
};

export const handlePaymentCallback = async (body: unknown): Promise<string> => {
  let checkoutToken: string | undefined;

  try {
    const form = parseIyzicoCallbackBody(body);
    checkoutToken = form.token?.trim();

    if (!checkoutToken) {
      return buildPaymentRedirectUrl('failed');
    }

    const result = await completePaymentFromCheckoutToken(checkoutToken);

    if (!result.success) {
      return buildPaymentRedirectUrl('failed', result.payment.orderId);
    }

    return buildPaymentRedirectUrl('success', result.payment.orderId);
  } catch (error) {
    const orderId = checkoutToken ? await findOrderIdByCheckoutToken(checkoutToken) : null;

    logger.error(
      { err: error, orderId, hasToken: Boolean(checkoutToken) },
      'Iyzico ödeme callback doğrulaması başarısız'
    );

    return buildPaymentRedirectUrl('failed', orderId);
  }
};
