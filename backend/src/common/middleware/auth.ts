import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/crypto.js";
import { pool } from "../../db/pool.js";
import { UnauthorizedError, ForbiddenError } from "../errors/app-error.js";
import type { ActorRole } from "../types/common.js";

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Authentication token required.", "MISSING_TOKEN"));
  }

  const token = authHeader.substring(7).trim();
  let claims;
  try {
    claims = verifyAccessToken(token);
  } catch {
    return next(new UnauthorizedError("Invalid or expired access token.", "INVALID_TOKEN"));
  }

  // Real-time status verification against the database
  try {
    if (claims.role === "admin") {
      const result = await pool.query("SELECT id, is_active FROM admin_users WHERE id = $1", [
        claims.sub,
      ]);
      if (result.rowCount === 0) {
        return next(new UnauthorizedError("Admin user not found.", "ADMIN_NOT_FOUND"));
      }
      const admin = result.rows[0];
      if (!admin.is_active) {
        return next(new ForbiddenError("Admin account is deactivated.", "ADMIN_DEACTIVATED"));
      }
    }

    req.actor = claims;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(allowedRole: ActorRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.actor) {
      return next(new UnauthorizedError("Authentication required.", "UNAUTHORIZED"));
    }

    if (req.actor.role !== allowedRole) {
      return next(new ForbiddenError("Insufficient permissions.", "FORBIDDEN"));
    }

    next();
  };
}
