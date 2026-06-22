/** Catalog servisi entrypoint — SERVICE_ROLE=catalog (sadece public catalog route'lar\u0131). */
if (!process.env.SERVICE_ROLE) {
  process.env.SERVICE_ROLE = 'catalog';
}

void import('@/app/server').then(({ start }) => start());
