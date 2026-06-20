import Iyzipay from 'iyzipay';
import { getIyzicoClient } from '@/integrations/iyzico/client';
import { promisifyIyzipay } from '@/integrations/iyzico/promisify';
import { retrieveIyzicoPaymentItemTransactions } from '@/integrations/iyzico/retrieve-payment-detail';
import type { CompleteCheckoutResult } from '@/integrations/iyzico/types';
import { HttpError } from '@/internal/common/errors';

const parsePaidAmount = (paidPrice: string | undefined): number => {
  if (!paidPrice) {
    return Number.NaN;
  }

  const amount = Number(paidPrice);

  return Number.isFinite(amount) ? amount : Number.NaN;
};

export const completeIyzicoCheckout = async (token: string): Promise<CompleteCheckoutResult> => {
  const client = getIyzicoClient();

  const result = await promisifyIyzipay(client.checkoutForm.retrieve.bind(client.checkoutForm), {
    locale: Iyzipay.LOCALE.TR,
    token,
  });

  if (result.status !== 'success') {
    throw new HttpError(502, 'Ödeme doğrulanamadı');
  }

  const orderId = result.basketId ?? result.conversationId;

  if (!orderId) {
    throw new HttpError(502, 'Ödeme yanıtında sipariş bilgisi bulunamadı');
  }

  if (result.paymentStatus !== 'SUCCESS') {
    return {
      status: 'failed',
      orderId,
      reason: result.errorMessage ?? 'Ödeme başarısız',
    };
  }

  if (!result.paymentId) {
    throw new HttpError(502, 'Ödeme yanıtında ödeme kimliği bulunamadı');
  }

  const paidAmount = parsePaidAmount(result.paidPrice);

  if (!Number.isFinite(paidAmount)) {
    throw new HttpError(502, 'Ödeme yanıtında tutar bilgisi bulunamadı');
  }

  const inlineTransactions =
    result.itemTransactions
      ?.filter((item) => item.itemId && item.paymentTransactionId)
      .map((item) => ({
        itemId: String(item.itemId),
        paymentTransactionId: String(item.paymentTransactionId),
      })) ?? [];

  const itemTransactions =
    inlineTransactions.length > 0
      ? inlineTransactions
      : await retrieveIyzicoPaymentItemTransactions(String(result.paymentId), orderId);

  return {
    status: 'completed',
    externalId: String(result.paymentId),
    orderId,
    paidAmount,
    itemTransactions,
  };
};
