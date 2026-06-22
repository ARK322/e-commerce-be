import Iyzipay from 'iyzipay';
import { getPaymentConfig } from '@/integrations/iyzico/config';
import { getIyzicoClient } from '@/integrations/iyzico/client';
import { formatIyzicoDate, formatIyzicoPhone, formatIyzicoPrice } from '@/integrations/iyzico/format';
import { promisifyIyzipay } from '@/integrations/iyzico/promisify';
import type { InitializeCheckoutInput, InitializeCheckoutResult } from '@/integrations/iyzico/types';
import { HttpError } from '@/shared/errors';

export const initializeIyzicoCheckout = async (
  input: InitializeCheckoutInput
): Promise<InitializeCheckoutResult> => {
  const config = getPaymentConfig();

  const client = getIyzicoClient();
  const price = formatIyzicoPrice(input.amount);
  const contactName = `${input.buyer.firstName} ${input.buyer.lastName}`.trim();
  const basketItems = input.items.map((item) => ({
    id: item.productId,
    name: item.name.slice(0, 100),
    category1: 'E-commerce',
    itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,
    price: formatIyzicoPrice(item.subtotal),
    subMerchantKey: item.subMerchantKey,
    subMerchantPrice: formatIyzicoPrice(item.subMerchantPrice),
  }));

  const result = await promisifyIyzipay(
    client.checkoutFormInitialize.create.bind(client.checkoutFormInitialize),
    {
      locale: Iyzipay.LOCALE.TR,
      conversationId: input.orderId,
      price,
      paidPrice: price,
      currency: Iyzipay.CURRENCY.TRY,
      basketId: input.orderId,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl: config.callbackUrl,
      enabledInstallments: [1],
      buyer: {
        id: input.buyerId,
        name: input.buyer.firstName,
        surname: input.buyer.lastName,
        gsmNumber: formatIyzicoPhone(input.buyer.phone),
        email: input.buyer.email,
        identityNumber: input.buyer.nationalId,
        registrationDate: formatIyzicoDate(input.buyer.createdAt),
        lastLoginDate: formatIyzicoDate(new Date()),
        registrationAddress: input.buyer.address,
        ip: input.clientIp,
        city: input.buyer.city,
        country: input.buyer.country,
      },
      shippingAddress: {
        contactName,
        city: input.buyer.city,
        country: input.buyer.country,
        address: input.buyer.address,
      },
      billingAddress: {
        contactName,
        city: input.buyer.city,
        country: input.buyer.country,
        address: input.buyer.address,
      },
      basketItems,
    }
  );

  if (result.status !== 'success' || !result.token) {
    throw new HttpError(
      502,
      result.errorMessage ?? 'Iyzico ödeme formu oluşturulamadı'
    );
  }

  return {
    token: result.token,
    paymentPageUrl: result.paymentPageUrl ?? null,
    checkoutFormContent: result.checkoutFormContent ?? null,
  };
};
