import Iyzipay from 'iyzipay';
import { getIyzicoClient } from '@/integrations/iyzico/client';
import { postIyzicoApi } from '@/integrations/iyzico/iyzico-http';
import { promisifyIyzipay } from '@/integrations/iyzico/promisify';
import { createLogger } from '@/internal/common/logging';

const log = createLogger({ module: 'iyzico-refund' });

type RefundResult = { status: string; errorMessage?: string };

type RefundClient = {
  refund?: {
    create?: (
      request: Record<string, unknown>,
      callback: (err: unknown, result: RefundResult) => void
    ) => void;
  };
  cancel?: {
    create?: (
      request: Record<string, unknown>,
      callback: (err: unknown, result: RefundResult) => void
    ) => void;
  };
};

const buildRefundRequest = (paymentId: string, amount: number, conversationId: string) => ({
  locale: Iyzipay.LOCALE.TR,
  conversationId,
  paymentId,
  price: amount.toFixed(2),
  currency: Iyzipay.CURRENCY.TRY,
  ip: '127.0.0.1',
});

const trySdkRefund = async (
  client: RefundClient,
  request: Record<string, unknown>
): Promise<boolean> => {
  if (client.refund?.create) {
    const result = await promisifyIyzipay(client.refund.create.bind(client.refund), request);
    return result.status === 'success';
  }

  if (client.cancel?.create) {
    const result = await promisifyIyzipay(client.cancel.create.bind(client.cancel), request);
    return result.status === 'success';
  }

  return false;
};

const tryRawRefund = async (request: Record<string, unknown>): Promise<boolean> => {
  const result = await postIyzicoApi<RefundResult>('/payment/refund', request);
  return result.status === 'success';
};

export const refundIyzicoPayment = async (
  paymentId: string,
  amount: number,
  conversationId: string
): Promise<boolean> => {
  const client = getIyzicoClient() as unknown as RefundClient;
  const request = buildRefundRequest(paymentId, amount, conversationId);

  try {
    if (await trySdkRefund(client, request)) {
      return true;
    }
  } catch (error) {
    log.warn({ err: error, paymentId, conversationId }, 'Iyzico SDK iade başarısız; HTTP deneniyor');
  }

  try {
    if (await tryRawRefund(request)) {
      return true;
    }

    log.error({ paymentId, conversationId }, 'Iyzico HTTP iade başarısız');
    return false;
  } catch (error) {
    log.error({ err: error, paymentId, conversationId }, 'Iyzico iade/iptal isteği başarısız');
    return false;
  }
};
