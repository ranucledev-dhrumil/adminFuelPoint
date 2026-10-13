import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express, type Request, type Response } from "express";
import helmet from "helmet";
import { errorHandler } from "./common/middleware/error-handler.js";
import { generalRateLimiter } from "./common/middleware/rate-limiter.js";
import { requestLogger } from "./common/middleware/request-logger.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { adminRouter } from "./modules/admin-users/admin.routes.js";
import { customerMobileRouter } from "./modules/customers/customer-mobile.routes.js";
import { workerTransactionRouter } from "./modules/transactions/worker-transaction.routes.js";

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

// Body and Cookie parsing
app.use(express.json());
app.use(cookieParser());

// Request logging and rate limiting
app.use(requestLogger);
app.use(generalRateLimiter);

// Domain Routes
app.use(`${env.API_PREFIX}/auth`, authRouter);
app.use(`${env.API_PREFIX}/admin`, adminRouter);
app.use(`${env.API_PREFIX}/customer`, customerMobileRouter);
app.use(`${env.API_PREFIX}/worker`, workerTransactionRouter);

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
