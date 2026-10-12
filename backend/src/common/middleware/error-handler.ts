import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error.js";
import { logger } from "../utils/logger.js";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? null,
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join("."),
      issue: issue.message,
    }));

    res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Input validation failed.",
        details,
      },
    });
    return;
  }

  // Handle invalid JSON body syntax errors from express.json()
  if ("status" in err && err.status === 400 && "body" in err) {
    res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "Malformed JSON payload provided.",
        details: null,
      },
    });
    return;
  }

  logger.error({ err }, "Unhandled server exception");

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
      details: null,
    },
  });
}
