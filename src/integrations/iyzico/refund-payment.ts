import Iyzipay from 'iyzipay';
import { getIyzicoClient } from '@/integrations/iyzico/client';
import { promisifyIyzipay } from '@/integrations/iyzico/promisify';
import { createLogger } from '@/internal/common/logging';

const log = createLogger({ module: 'iyzico-refund' });

type RefundClient = {
  refund?: {
    create?: (
      request: Record<string, unknown>,
      callback: (err: unknown, result: { status: string; errorMessage?: string }) => void
    ) => void;
  };
  cancel?: {
    create?: (
      request: Record<string, unknown>,
      callback: (err: unknown, result: { status: string; errorMessage?: string }) => void
    ) => void;
  };
};

export const refundIyzicoPayment = async (
  paymentId: string,
  amount: number,
  conversationId: string
): Promise<boolean> => {
  const client = getIyzicoClient() as unknown as RefundClient;

  const request = {
    locale: Iyzipay.LOCALE.TR,
    conversationId,
    paymentId,
    price: amount.toFixed(2),
    currency: Iyzipay.CURRENCY.TRY,
    ip: '127.0.0.1',
  };

  try {
    if (client.refund?.create) {
      const result = await promisifyIyzipay(client.refund.create.bind(client.refund), request);

      if (result.status === 'success') {
        return true;
      }

      log.error({ paymentId, conversationId, result }, 'Iyzico iade başarısız');
      return false;
    }

    if (client.cancel?.create) {
      const result = await promisifyIyzipay(client.cancel.create.bind(client.cancel), request);

      if (result.status === 'success') {
        return true;
      }

      log.error({ paymentId, conversationId, result }, 'Iyzico iptal başarısız');
      return false;
    }
  } catch (error) {
    log.error({ err: error, paymentId, conversationId }, 'Iyzico iade/iptal isteği başarısız');
    return false;
  }

  log.warn({ paymentId, conversationId }, 'Iyzico SDK iade/iptal API bulunamadı; manuel iade gerekir');
  return false;
};
