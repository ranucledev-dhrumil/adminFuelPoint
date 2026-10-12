import cors from "cors";
import express, { type Express, type Request, type Response } from "express";
import helmet from "helmet";
import { errorHandler } from "./common/middleware/error-handler.js";
import { generalRateLimiter } from "./common/middleware/rate-limiter.js";
import { requestLogger } from "./common/middleware/request-logger.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";

export const app: Express = express();

// Security headers
app.use(helmet());

// CORS with credentials support
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);

// Body parsing
app.use(express.json());

// Request logging and rate limiting
app.use(requestLogger);
app.use(generalRateLimiter);

// Health check endpoint
app.get(`${env.API_PREFIX}/health`, async (_req: Request, res: Response) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: error instanceof Error ? error.message : "Database connection failed",
    });
  }
});

// 404 handler for unknown routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "The requested API endpoint was not found.",
      details: null,
    },
  });
});

// Global error handler
app.use(errorHandler);
