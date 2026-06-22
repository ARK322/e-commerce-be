import Iyzipay from 'iyzipay';
import { getIyzicoClient } from '@/infrastructure/iyzico/client';
import { promisifyIyzipay } from '@/infrastructure/iyzico/promisify';
import type { IyzicoItemTransaction } from '@/infrastructure/iyzico/types';
import { HttpError } from '@/shared/errors';

export const retrieveIyzicoPaymentItemTransactions = async (
  paymentId: string,
  conversationId: string
): Promise<IyzicoItemTransaction[]> => {
  const client = getIyzicoClient();

  const result = await promisifyIyzipay(
    client.payment.retrieve!.bind(client.payment),
    {
      locale: Iyzipay.LOCALE.TR,
      conversationId,
      paymentId,
    }
  );

  if (result.status !== 'success') {
    throw new HttpError(
      502,
      result.errorMessage ?? 'Iyzico ödeme detayı alınamadı'
    );
  }

  const transactions = result.itemTransactions ?? [];

  return transactions
    .filter((item) => item.itemId && item.paymentTransactionId)
    .map((item) => ({
      itemId: String(item.itemId),
      paymentTransactionId: String(item.paymentTransactionId),
    }));
};
