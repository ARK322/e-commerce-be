import postgres from "postgres";
import type { Env } from "../config/env.js";

export function createSql(env: Env) {
  return postgres(env.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

export type Sql = ReturnType<typeof createSql>;
