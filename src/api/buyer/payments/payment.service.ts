import { env } from '@/config/env';
import type { PaymentStatus } from '@/integrations/mongo';
import { findBuyerOrder, findOrderByIdLean } from '@/domains/commerce/infrastructure/repositories/order.repository';
import { findBuyerPaymentProfileLean } from '@/domains/identity/infrastructure/repositories/buyer.repository';
import {
  createPayment,
  findOrderIdByCheckoutToken,
  findPaymentByOrderId,
  findPaymentByOrderIdLean,
  savePaymentDocument,
} from '@/domains/payments/infrastructure/repositories/payment.repository';
import { initializeIyzicoCheckout } from '@/integrations/iyzico/initialize-checkout';
import { completeIyzicoCheckout } from '@/integrations/iyzico/retrieve-checkout';
import { assertPurchasableCatalogProduct } from '@/domains/catalog/application/product/assert-purchasable-product';
import { CommerceError } from '@/shared/errors/commerce-error';
import { logger } from '@/shared/logging';
import type { CreatePaymentInput } from '@/api/buyer/payments/create-payment.schema';
import { buildPaymentSplitsForOrder } from '@/domains/payments/application/payment/payment-split';
import { logPaymentTransition } from '@/domains/payments/application/payment/payment-audit';
import {
  assertProductStockAvailable,
  assertSellersReadyForOrder,
} from '@/domains/commerce/application/orders/order-item-validation';
import { reservePendingOrderStock } from '@/domains/commerce/application/orders/reserve-order-stock';
import {
  finalizeFailedIyzicoCheckout,
  finalizeSuccessfulIyzicoCheckout,
  toPaymentResponse,
} from '@/domains/payments/application/payment/finalize-checkout-payment';

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

const loadBuyerPaymentProfile = async (buyerId: string) => {
  const { user, buyer } = await findBuyerPaymentProfileLean(buyerId);

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
    email: String(user.email),
    firstName: buyer.firstName,
    lastName: buyer.lastName,
    phone: buyer.phone,
    nationalId: buyer.nationalId,
    country: buyer.country,
    city: buyer.city,
    address: buyer.deliveryAddress,
    createdAt: (user.createdAt as Date | undefined) ?? new Date(),
  };
};

const assertOrderReadyForPayment = async (
  items: OrderItemRecord[],
  options?: { stockAlreadyReserved?: boolean }
) => {
  await assertSellersReadyForOrder(items);

  for (const item of items) {
    const product = await assertPurchasableCatalogProduct(item.productId);

    if (!options?.stockAlreadyReserved) {
      assertProductStockAvailable(product, item.quantity);
    }
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

  const existingPayment = await findPaymentByOrderId(input.orderId);

  if (existingPayment?.status === 'completed') {
    throw new CommerceError(409, 'Bu sipariş için ödeme zaten tamamlandı');
  }

  if (existingPayment?.status === 'processing') {
    throw new CommerceError(409, 'Bu sipariş için ödeme işleniyor');
  }

  const stockAlreadyReserved = Boolean(order.stockReserved);

  await assertOrderReadyForPayment(order.items as OrderItemRecord[], { stockAlreadyReserved });

  if (!stockAlreadyReserved) {
    await reservePendingOrderStock(
      input.orderId,
      order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }))
    );
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
    (await createPayment({
      orderId: input.orderId,
      buyerId,
      amount: order.totalAmount,
      currency: order.currency,
      provider: 'iyzico',
      status: 'pending',
    }));

  payment.provider = 'iyzico';
  payment.externalId = checkout.token;
  const prevStatus = payment.status as PaymentStatus;
  payment.status = 'pending';
  await savePaymentDocument(payment);
  if (prevStatus !== 'pending') {
    logPaymentTransition({
      paymentId: String(payment._id),
      orderId: payment.orderId,
      from: prevStatus,
      to: 'pending',
      reason: 'checkout_initialized',
    });
  }

  return {
    payment: toPaymentResponse(payment.toObject()),
    checkout,
  };
};

export const completePaymentFromCheckoutToken = async (token: string) => {
  const result = await completeIyzicoCheckout(token);

  if (result.status === 'failed') {
    return finalizeFailedIyzicoCheckout(result.orderId, result.reason);
  }

  return finalizeSuccessfulIyzicoCheckout(result);
};

export const getPaymentByOrderId = async (buyerId: string, orderId: string) => {
  await findBuyerOrder(buyerId, orderId);

  const payment = await findPaymentByOrderIdLean(orderId);

  if (!payment) {
    throw new CommerceError(404, 'Ödeme kaydı bulunamadı');
  }

  return toPaymentResponse(payment);
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
