import type { RequestHandler } from "express";
import { pinoHttp } from "pino-http";
import { logger } from "../utils/logger.js";

export const requestLogger: RequestHandler = pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url?.includes("/health") ?? false,
  },
});
