import { env } from '@/config/env';

export type PaymentConfig = {
  apiKey: string;
  secretKey: string;
  uri: string;
  callbackUrl: string;
};

export const getPaymentConfig = (): PaymentConfig => {
  const apiKey = env.iyzipayApiKey;
  const secretKey = env.iyzipaySecretKey;

  if (!apiKey || !secretKey) {
    throw new Error('IYZIPAY_API_KEY ve IYZIPAY_SECRET_KEY tanımlı olmalı');
  }

  const callbackUrl = env.resolveIyzipayCallbackUrl();

  if (!callbackUrl) {
    throw new Error('IYZIPAY_CALLBACK_URL veya API_BASE_URL tanımlı olmalı');
  }

  return {
    apiKey,
    secretKey,
    uri: env.resolveIyzicoUri(apiKey),
    callbackUrl,
  };
};
