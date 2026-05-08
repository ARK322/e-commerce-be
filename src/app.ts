import cors from "@fastify/cors";
import fjwt from "@fastify/jwt";
import Fastify from "fastify";
import type { Env } from "./config/env.js";
import { createSql } from "./db/client.js";
import { authRoutes } from "./modules/auth/index.js";
import { catalogRoutes } from "./modules/catalog/index.js";
import { categoriesRoutes } from "./modules/categories/index.js";
import { healthRoutes } from "./modules/health/index.js";
import { sellerRoutes } from "./modules/seller/index.js";

export async function buildApp(env: Env) {
  const sql = createSql(env);

  const app = Fastify({ logger: true });
  app.decorate("sql", sql);

  await app.register(cors, { origin: true });

  await app.register(fjwt, {
    secret: env.JWT_SECRET,
  });

  app.decorate("authenticate", async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch {
      await reply.code(401).send({ error: "unauthorized" });
    }
  });

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: "/v1" });
  await app.register(categoriesRoutes, { prefix: "/v1" });
  await app.register(catalogRoutes, { prefix: "/v1" });
  await app.register(sellerRoutes, { prefix: "/v1" });

  app.addHook("onClose", async () => {
    await sql.end({ timeout: 5 });
  });

  return app;
}
