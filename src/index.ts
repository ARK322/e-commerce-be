import "dotenv/config";

import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";

const env = loadEnv();
const app = await buildApp(env);

await app.listen({ port: env.PORT, host: env.HOST });
app.log.info(`Listening on ${env.HOST}:${env.PORT}`);
