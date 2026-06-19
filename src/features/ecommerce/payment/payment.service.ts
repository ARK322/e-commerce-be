import { Buyer, Order, Payment, User } from '@/integrations/mongo';
import { createUserId } from '@/internal/ids';
import { getBuyerOrder } from '@/features/ecommerce/order/order.service';
import { initializeIyzicoCheckout } from '@/integrations/iyzico/initialize-checkout';
import { completeIyzicoCheckout } from '@/integrations/iyzico/retrieve-checkout';
import { EcommerceError } from '@/internal/ecommerce/errors';
import type { CreatePaymentInput } from '@/features/ecommerce/payment/create-payment.schema';
import {
  buildPaymentSplitsForOrder,
  syncPaymentSplitTransactionIds,
} from '@/internal/ecommerce/payment/payment-split';

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

type CreatePaymentOptions = {
  clientIp?: string;
};

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

const loadBuyerPaymentProfile = async (buyerId: string) => {
  const [user, buyer] = await Promise.all([
    User.findById(buyerId).lean(),
    Buyer.findById(buyerId).lean(),
  ]);

  if (!user?.email) {
    throw new EcommerceError(400, 'Ödeme için e-posta bilgisi eksik');
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
    throw new EcommerceError(400, 'Ödeme için profil bilgileri eksik (TC kimlik no dahil)');
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

const markOrderPaid = async (orderId: string) => {
  const order = await Order.findById(orderId);

  if (!order) {
    throw new EcommerceError(404, 'Sipariş bulunamadı');
  }

  if (order.status === 'pending') {
    order.status = 'paid';
    order.updatedAt = new Date();
    await order.save();
  }
};

export const createPaymentForOrder = async (
  buyerId: string,
  input: CreatePaymentInput,
  options?: CreatePaymentOptions
) => {
  const order = await getBuyerOrder(buyerId, input.orderId);

  if (order.status !== 'pending') {
    throw new EcommerceError(400, 'Sipariş ödemeye uygun değil');
  }

  const existingPayment = await Payment.findOne({ orderId: input.orderId });

  if (existingPayment?.status === 'completed') {
    throw new EcommerceError(409, 'Bu sipariş için ödeme zaten tamamlandı');
  }

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

export const completePaymentFromCheckoutToken = async (token: string) => {
  const result = await completeIyzicoCheckout(token);
  const payment = await Payment.findOne({ orderId: result.orderId });

  if (!payment) {
    throw new EcommerceError(404, 'Ödeme kaydı bulunamadı');
  }

  if (result.status === 'failed') {
    payment.status = 'failed';
    payment.updatedAt = new Date();
    await payment.save();

    return {
      payment: toPaymentResponse(payment.toObject()),
      success: false as const,
      reason: result.reason,
    };
  }

  if (payment.status !== 'completed') {
    payment.status = 'completed';
    payment.provider = 'iyzico';
    payment.externalId = result.externalId;
    payment.updatedAt = new Date();
    await payment.save();
    await syncPaymentSplitTransactionIds(result.orderId, result.itemTransactions);
    await markOrderPaid(result.orderId);
  }

  return {
    payment: toPaymentResponse(payment.toObject()),
    success: true as const,
  };
};

export const getPaymentByOrderId = async (buyerId: string, orderId: string) => {
  await getBuyerOrder(buyerId, orderId);

  const payment = await Payment.findOne({ orderId }).lean();

  if (!payment) {
    throw new EcommerceError(404, 'Ödeme kaydı bulunamadı');
  }

  return toPaymentResponse(payment as PaymentRecord);
};
