import { startUnverifiedUserExpiryScheduler } from '@/domains/identity/application/register/expire-unverified-users';

export const startIdentitySchedulers = (): void => {
  startUnverifiedUserExpiryScheduler();
};
