import formbody from '@fastify/formbody';
import { FastifyInstance } from 'fastify';

/** Iyzico checkout callback ve diğer form POST istekleri için. */
export const registerFormBody = async (app: FastifyInstance): Promise<void> => {
  await app.register(formbody);
};
