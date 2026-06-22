import crypto from 'crypto';
import { getPaymentConfig } from '@/infrastructure/iyzico/config';

const RANDOM_STRING_SIZE = 8;
const CLIENT_VERSION = 'iyzipay-node-2.0.67';

const generateRandomString = (size: number): string =>
  String(process.hrtime()[0]) + Math.random().toString(size).slice(2);

const buildAuthorizationHeader = (
  apiKey: string,
  secretKey: string,
  uri: string,
  body: Record<string, unknown>
) => {
  const randomString = generateRandomString(RANDOM_STRING_SIZE);
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(randomString + uri + JSON.stringify(body))
    .digest('hex');
  const authorizationParams = [
    `apiKey:${apiKey}`,
    `randomKey:${randomString}`,
    `signature:${signature}`,
  ].join('&');

  return {
    authorization: `IYZWSv2 ${Buffer.from(authorizationParams).toString('base64')}`,
    randomString,
  };
};

export const postIyzicoApi = async <T extends { status: string }>(
  path: string,
  body: Record<string, unknown>
): Promise<T> => {
  const config = getPaymentConfig();
  const { authorization, randomString } = buildAuthorizationHeader(
    config.apiKey,
    config.secretKey,
    path,
    body
  );

  const response = await fetch(`${config.uri}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authorization,
      'x-iyzi-rnd': randomString,
      'x-iyzi-client-version': CLIENT_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Iyzico HTTP ${response.status}`);
  }

  return (await response.json()) as T;
};
