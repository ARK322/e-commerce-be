import Fastify from "fastify";
import dbPlugin from "./plugins/db.js";
import authGuardPlugin from "./plugins/authGuard.js";
import { authRoutes } from "./modules/auth/auth.routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
    // Avvio varsayılan plugin timeout'u 10 sn; Atlas bağlantısı bunu aşabiliyor
    pluginTimeout: 30_000,
  });

  await app.register(dbPlugin);
  await app.register(authGuardPlugin);

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(authRoutes, { prefix: "/api/auth" });

  return app;
}
