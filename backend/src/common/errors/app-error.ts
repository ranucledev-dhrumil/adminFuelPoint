export interface ErrorDetail {
  field?: string;
  issue: string;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "INTERNAL_SERVER_ERROR",
    details: unknown = null,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(
    message: string = "Bad Request",
    code: string = "BAD_REQUEST",
    details: unknown = null,
  ) {
    super(message, 400, code, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(
    message: string = "Unauthorized",
    code: string = "UNAUTHORIZED",
    details: unknown = null,
  ) {
    super(message, 401, code, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden", code: string = "FORBIDDEN", details: unknown = null) {
    super(message, 403, code, details);
  }
}

export class NotFoundError extends AppError {
  constructor(
    message: string = "Resource not found",
    code: string = "NOT_FOUND",
    details: unknown = null,
  ) {
    super(message, 404, code, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Conflict", code: string = "CONFLICT", details: unknown = null) {
    super(message, 409, code, details);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string = "Input validation failed",
    code: string = "VALIDATION_ERROR",
    details: ErrorDetail[] | unknown = null,
  ) {
    super(message, 422, code, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(
    message: string = "Too many requests. Please try again later.",
    code: string = "TOO_MANY_REQUESTS",
    details: unknown = null,
  ) {
    super(message, 429, code, details);
  }
}

export class InternalServerError extends AppError {
  constructor(
    message: string = "Internal server error",
    code: string = "INTERNAL_SERVER_ERROR",
    details: unknown = null,
  ) {
    super(message, 500, code, details);
  }
}
