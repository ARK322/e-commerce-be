import fp from "fastify-plugin";
import mongoose from "mongoose";
import type { FastifyPluginAsync } from "fastify";
import "../models/index.js";

const MONGOOSE_OPTIONS: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 15_000,
  connectTimeoutMS: 15_000,
  socketTimeoutMS: 45_000,
  maxPoolSize: 10,
  // Railway gibi container ortamlarında IPv6 kaynaklı gecikmeleri azaltır
  family: 4,
};

function getMongoLogContext(uri: string): {
  host: string;
  database: string;
  protocol: string;
} {
  try {
    const url = new URL(uri);
    return {
      host: url.hostname,
      database: url.pathname.replace(/^\//, "") || "default",
      protocol: url.protocol,
    };
  } catch {
    return { host: "unknown", database: "unknown", protocol: "unknown" };
  }
}

const dbPlugin: FastifyPluginAsync = async (fastify) => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    const error = new Error("DATABASE_URL environment variable is not set");
    fastify.log.error(error);
    throw error;
  }

  const mongoContext = getMongoLogContext(databaseUrl);

  fastify.log.info(
    mongoContext,
    "MongoDB bağlantısı başlatılıyor...",
  );

  mongoose.set("bufferCommands", false);

  try {
    await mongoose.connect(databaseUrl, MONGOOSE_OPTIONS);
  } catch (error) {
    fastify.log.error(
      {
        err: error,
        ...mongoContext,
        readyState: mongoose.connection.readyState,
        hint:
          "Atlas IP whitelist, DATABASE_URL formatı veya ağ erişimini kontrol edin",
      },
      "MongoDB bağlantısı başarısız",
    );
    throw error;
  }

  fastify.log.info(
    {
      ...mongoContext,
      readyState: mongoose.connection.readyState,
    },
    "MongoDB bağlantısı başarılı",
  );

  fastify.decorate("db", mongoose.connection);

  fastify.addHook("onClose", async () => {
    fastify.log.info("MongoDB bağlantısı kapatılıyor...");
    await mongoose.disconnect();
    fastify.log.info("MongoDB bağlantısı kapatıldı");
  });
};

export default fp(dbPlugin, {
  name: "db",
});
