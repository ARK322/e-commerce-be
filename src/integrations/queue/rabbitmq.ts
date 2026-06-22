import type { Channel, Connection, ConsumeMessage } from 'amqplib';
import { env } from '@/config/env';
import { createLogger } from '@/shared/logging';

const log = createLogger({ module: 'rabbitmq' });

const DEFAULT_EXCHANGE = 'ecommerce.events';

let connection: Connection | null = null;
let channel: Channel | null = null;

/**
 * Lazy connect — import an\u0131nda ba\u011flanmaz. Sadece QUEUE_URL tan\u0131ml\u0131yken ve
 * publish/consume \u00e7a\u011fr\u0131ld\u0131\u011f\u0131nda kurulur (test/monolith modunda tetiklenmez).
 */
const getChannel = async (): Promise<Channel> => {
  if (channel) {
    return channel;
  }

  const url = env.queueUrl;

  if (!url) {
    throw new Error('QUEUE_URL tan\u0131ml\u0131 de\u011fil — RabbitMQ transport kullan\u0131lam\u0131yor');
  }

  const amqp = await import('amqplib');
  const conn = (await amqp.connect(url)) as unknown as Connection;
  const ch = await (conn as unknown as { createChannel: () => Promise<Channel> }).createChannel();
  await ch.assertExchange(DEFAULT_EXCHANGE, 'topic', { durable: true });

  (conn as unknown as { on: (e: string, cb: () => void) => void }).on('close', () => {
    log.warn('RabbitMQ ba\u011flant\u0131s\u0131 kapand\u0131');
    connection = null;
    channel = null;
  });

  connection = conn;
  channel = ch;

  log.info('RabbitMQ kanal\u0131 haz\u0131r');
  return ch;
};

export const publishToQueue = async (
  routingKey: string,
  message: Record<string, unknown>
): Promise<void> => {
  const ch = await getChannel();
  const payload = Buffer.from(JSON.stringify(message));
  ch.publish(DEFAULT_EXCHANGE, routingKey, payload, {
    persistent: true,
    contentType: 'application/json',
  });
};

export const consumeQueue = async (
  queueName: string,
  routingKeys: string[],
  handler: (message: Record<string, unknown>, raw: ConsumeMessage) => Promise<void>
): Promise<void> => {
  const ch = await getChannel();
  await ch.assertQueue(queueName, { durable: true });

  for (const key of routingKeys) {
    await ch.bindQueue(queueName, DEFAULT_EXCHANGE, key);
  }

  await ch.consume(queueName, (raw) => {
    if (!raw) {
      return;
    }

    void (async () => {
      try {
        const parsed = JSON.parse(raw.content.toString()) as Record<string, unknown>;
        await handler(parsed, raw);
        ch.ack(raw);
      } catch (error) {
        log.error({ err: error, queueName }, 'RabbitMQ mesaj\u0131 i\u015flenemedi — DLQ\'ya nack');
        ch.nack(raw, false, false);
      }
    })();
  });

  log.info({ queueName, routingKeys }, 'RabbitMQ consumer ba\u015flat\u0131ld\u0131');
};

export const closeQueue = async (): Promise<void> => {
  await channel?.close().catch(() => undefined);
  await (connection as unknown as { close?: () => Promise<void> })?.close?.().catch(
    () => undefined
  );
  channel = null;
  connection = null;
};
