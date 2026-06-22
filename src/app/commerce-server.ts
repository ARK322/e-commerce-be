/** Commerce servisi entrypoint — SERVICE_ROLE=commerce (cart, orders, fulfillment). */
if (!process.env.SERVICE_ROLE) {
  process.env.SERVICE_ROLE = 'commerce';
}

void import('@/app/server').then(({ start }) => start());
