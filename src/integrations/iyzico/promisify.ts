import { HttpError } from '@/shared/errors';
import { logger } from '@/shared/logging';

type IyzipayCallback<T> = (err: unknown, result: T) => void;

const toIyzipayError = (err: unknown): HttpError => {
  if (err instanceof HttpError) {
    return err;
  }

  logger.error({ err }, 'Iyzico isteği başarısız');

  return new HttpError(502, 'Ödeme servisi geçici olarak kullanılamıyor');
};

export const promisifyIyzipay = <T>(
  invoke: (request: Record<string, unknown>, callback: IyzipayCallback<T>) => void,
  request: Record<string, unknown>
): Promise<T> =>
  new Promise((resolve, reject) => {
    invoke(request, (err, result) => {
      if (err) {
        reject(toIyzipayError(err));
        return;
      }

      resolve(result);
    });
  });
