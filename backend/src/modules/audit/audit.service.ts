import type pg from "pg";
import { pool } from "../../db/pool.js";
import { parseDateBoundary } from "../../common/utils/date.js";
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

  async listAuditLogs(query: {
    page?: number;
    limit?: number;
    action?: string;
    actorType?: string;
    actorId?: string;
    entityType?: string;
    entityId?: string;
    reason?: string;
    from?: string;
    to?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

    const fromDate = query.from ? parseDateBoundary(query.from, "start") : undefined;
    const toDate = query.to ? parseDateBoundary(query.to, "end") : undefined;

    const { rows, total } = await auditRepository.findAuditLogs({
      page,
      limit,
      action: query.action,
      actorType: query.actorType,
      actorId: query.actorId,
      entityType: query.entityType,
      entityId: query.entityId,
      reason: query.reason,
      from: fromDate,
      to: toDate,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: rows.map((r) => ({
        id: r.id,
        actorType: r.actor_type,
        actorId: r.actor_id,
        actorName: r.actor_name,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id,
        oldStatus: r.old_status,
        newStatus: r.new_status,
        reason: r.reason,
        oldValue: r.old_value,
        newValue: r.new_value,
        ipAddress: r.ip_address,
        userAgent: r.user_agent,
        createdAt: r.created_at.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }
}

export const auditService = new AuditService();
