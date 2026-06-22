import { createLogger } from '@/shared/logging';
import { deleteUnverifiedUser } from '@/domain/auth/register/unverified-user';
import { listExpiredUnverifiedUsersLean } from '@/repositories/auth/user.repository';

const log = createLogger({ module: 'expire-unverified-users' });

export const expireUnverifiedUsers = async (): Promise<number> => {
  const expiredUsers = await listExpiredUnverifiedUsersLean(new Date());
  let removed = 0;

  for (const user of expiredUsers) {
    try {
      await deleteUnverifiedUser(String(user._id));
      removed += 1;
    } catch (error) {
      log.error({ err: error, userId: user._id }, 'Süresi dolan doğrulanmamış kullanıcı silinemedi');
    }
  }

  return removed;
};

export const startUnverifiedUserExpiryScheduler = (): void => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const run = () => {
    void expireUnverifiedUsers()
      .then((count) => {
        if (count > 0) {
          log.info({ count }, 'Süresi dolan doğrulanmamış kullanıcılar silindi');
        }
      })
      .catch((err) => {
        log.error({ err }, 'Doğrulanmamış kullanıcı temizliği başarısız');
      });
  };

  run();
  setInterval(run, 60 * 60_000);
};
