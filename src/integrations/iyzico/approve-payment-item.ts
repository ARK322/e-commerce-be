import Iyzipay from 'iyzipay';
import { getIyzicoClient } from '@/integrations/iyzico/client';
import { promisifyIyzipay } from '@/integrations/iyzico/promisify';
import { HttpError } from '@/shared/errors';

export const approveIyzicoPaymentItem = async (
  paymentTransactionId: string,
  conversationId: string
): Promise<void> => {
  const client = getIyzicoClient();

  const result = await promisifyIyzipay(
    client.approval.create!.bind(client.approval),
    {
      locale: Iyzipay.LOCALE.TR,
      conversationId,
      paymentTransactionId,
    }
  );

  if (result.status !== 'success') {
    throw new HttpError(
      502,
      result.errorMessage ?? 'Iyzico ödeme onayı gönderilemedi'
    );
  }
};
