import type { FastifyInstance } from 'fastify';

type MetricsSnapshot = {
  httpRequestsTotal: number;
  httpRequestDurationMsTotal: number;
};

const metrics: MetricsSnapshot = {
  httpRequestsTotal: 0,
  httpRequestDurationMsTotal: 0,
};

export const registerMetrics = (app: FastifyInstance): void => {
  app.addHook('onResponse', async (request, reply) => {
    metrics.httpRequestsTotal += 1;
    metrics.httpRequestDurationMsTotal += reply.elapsedTime;
  });

  app.get('/metrics', async (_request, reply) => {
    const lines = [
      '# HELP http_requests_total Total HTTP requests handled',
      '# TYPE http_requests_total counter',
      `http_requests_total ${metrics.httpRequestsTotal}`,
      '# HELP http_request_duration_ms_total Cumulative HTTP response time in ms',
      '# TYPE http_request_duration_ms_total counter',
      `http_request_duration_ms_total ${Math.round(metrics.httpRequestDurationMsTotal)}`,
    ];

    return reply.header('content-type', 'text/plain; charset=utf-8').status(200).send(lines.join('\n'));
  });
};
