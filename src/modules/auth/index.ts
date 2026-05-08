import type { FastifyPluginAsync } from "fastify";
import {
  loginBodySchema,
  registerBodySchema,
} from "./schemas.js";
import { authenticateUser, getMe, registerUser } from "./service.js";

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/register", async (request, reply) => {
    const parsed = registerBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }

    const result = await registerUser(app.sql, parsed.data);
    if (!result) {
      return reply.code(409).send({ error: "email_taken" });
    }

    const token = await reply.jwtSign(
      { sub: result.userId, role: result.role },
      { expiresIn: "7d" },
    );

    return reply.code(201).send({
      token,
      userId: result.userId,
      role: result.role,
    });
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = loginBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }

    const user = await authenticateUser(app.sql, parsed.data.email, parsed.data.password);
    if (!user) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }

    const token = await reply.jwtSign(
      { sub: user.id, role: user.role },
      { expiresIn: "7d" },
    );

    return { token, userId: user.id, role: user.role };
  });

  app.get(
    "/auth/me",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const sub = request.user.sub;
      const me = await getMe(app.sql, sub);
      if (!me) {
        return reply.code(404).send({ error: "not_found" });
      }
      return me;
    },
  );
};
