import type { Sql } from "../db/client.js";

declare module "fastify" {
  interface FastifyInstance {
    sql: Sql;
    authenticate: (
      request: import("fastify").FastifyRequest,
      reply: import("fastify").FastifyReply,
    ) => Promise<void>;
  }
}
