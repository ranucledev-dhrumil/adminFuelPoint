import type { Server } from "http";
import { app } from "./app.js";
import { logger } from "./common/utils/logger.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";

const server: Server = app.listen(env.PORT, env.HOST, () => {
  logger.info(
    `FuelPoint Backend listening on http://${env.HOST}:${env.PORT}${env.API_PREFIX} [${env.NODE_ENV}]`,
  );
});

let isShuttingDown = false;

async function handleShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Force shutdown after timeout
  const forceExitTimeout = setTimeout(() => {
    logger.error("Graceful shutdown timeout exceeded. Forcing termination.");
    process.exit(1);
  }, 10000);
  forceExitTimeout.unref();

  server.close(async (err) => {
    if (err) {
      logger.error({ err }, "Error while closing HTTP server");
    } else {
      logger.info("HTTP server closed.");
    }

    try {
      await pool.end();
      logger.info("PostgreSQL connection pool drained and closed.");
    } catch (poolErr) {
      logger.error({ err: poolErr }, "Error closing database pool");
    }

    logger.info("Graceful shutdown complete.");
    process.exit(0);
  });
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));
