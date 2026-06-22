/** Payments servisi entrypoint — SERVICE_ROLE=payments (payments, wallet, callback). */
if (!process.env.SERVICE_ROLE) {
  process.env.SERVICE_ROLE = 'payments';
}

void import('@/app/server').then(({ start }) => start());
