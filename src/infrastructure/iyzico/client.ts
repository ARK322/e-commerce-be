import Iyzipay from 'iyzipay';
import { getPaymentConfig } from '@/infrastructure/iyzico/config';

let cachedClient: InstanceType<typeof Iyzipay> | null = null;

export const getIyzicoClient = (): InstanceType<typeof Iyzipay> => {
  if (cachedClient) {
    return cachedClient;
  }

  const config = getPaymentConfig();

  cachedClient = new Iyzipay({
    apiKey: config.apiKey,
    secretKey: config.secretKey,
    uri: config.uri,
  });

  return cachedClient;
};
