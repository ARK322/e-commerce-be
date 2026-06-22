/** Identity servisi entrypoint — SERVICE_ROLE=identity (/auth scope). */
if (!process.env.SERVICE_ROLE) {
  process.env.SERVICE_ROLE = 'identity';
}

void import('@/app/server').then(({ start }) => start());
