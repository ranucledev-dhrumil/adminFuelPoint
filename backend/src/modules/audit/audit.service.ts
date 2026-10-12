import type pg from "pg";
import { pool } from "../../db/pool.js";
import { auditRepository, type CreateAuditEntryParams } from "./audit.repository.js";

const SENSITIVE_KEYS = new Set([
  "password",
  "password_hash",
  "passwordHash",
  "token",
  "token_hash",
  "tokenHash",
  "refreshToken",
  "code",
  "code_hash",
  "codeHash",
  "qr_token",
  "qrToken",
]);

function sanitizeSnapshot(obj?: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!obj) return null;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key)) {
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      sanitized[key] = sanitizeSnapshot(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export class AuditService {
  async recordInTx(
    params: CreateAuditEntryParams,
    client: pg.PoolClient | pg.Pool,
  ): Promise<string> {
    const cleanParams: CreateAuditEntryParams = {
      ...params,
      oldValue: sanitizeSnapshot(params.oldValue),
      newValue: sanitizeSnapshot(params.newValue),
    };
    return auditRepository.insertEntry(cleanParams, client);
  }

  async recordStandalone(params: CreateAuditEntryParams, dbPool: pg.Pool = pool): Promise<string> {
    const cleanParams: CreateAuditEntryParams = {
      ...params,
      oldValue: sanitizeSnapshot(params.oldValue),
      newValue: sanitizeSnapshot(params.newValue),
    };
    return auditRepository.insertEntry(cleanParams, dbPool);
  }
}

export const auditService = new AuditService();
