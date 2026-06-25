/**
 * Lightweight checkout load probe — no extra dependencies.
 *
 * Usage:
 *   node scripts/load-test/checkout-load.mjs
 *   BASE_URL=http://localhost:8080 CONCURRENCY=10 DURATION_SEC=15 node scripts/load-test/checkout-load.mjs
 *
 * Hits public catalog endpoints as a proxy for checkout-path latency.
 * For full auth checkout load, wire tokens and extend the paths array.
 */

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:8080').replace(/\/+$/, '');
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 5);
const DURATION_SEC = Number(process.env.DURATION_SEC ?? 10);

const paths = ['/categories', '/products?limit=10'];

const stats = {
  total: 0,
  ok: 0,
  failed: 0,
  latencies: [],
};

const requestOnce = async (path) => {
  const started = performance.now();

  try {
    const response = await fetch(`${BASE_URL}${path}`);
    const elapsed = performance.now() - started;
    stats.total += 1;
    stats.latencies.push(elapsed);

    if (response.ok) {
      stats.ok += 1;
    } else {
      stats.failed += 1;
    }
  } catch {
    stats.total += 1;
    stats.failed += 1;
    stats.latencies.push(performance.now() - started);
  }
};

const worker = async (deadline) => {
  while (Date.now() < deadline) {
    const path = paths[stats.total % paths.length];
    await requestOnce(path);
  }
};

const percentile = (values, p) => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
};

const run = async () => {
  const deadline = Date.now() + DURATION_SEC * 1000;
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(deadline)));

  const avg =
    stats.latencies.reduce((sum, value) => sum + value, 0) / (stats.latencies.length || 1);

  console.log(
    JSON.stringify(
      {
        baseUrl: BASE_URL,
        concurrency: CONCURRENCY,
        durationSec: DURATION_SEC,
        total: stats.total,
        ok: stats.ok,
        failed: stats.failed,
        latencyMs: {
          avg: Math.round(avg),
          p50: Math.round(percentile(stats.latencies, 50)),
          p95: Math.round(percentile(stats.latencies, 95)),
        },
      },
      null,
      2
    )
  );
};

void run();
