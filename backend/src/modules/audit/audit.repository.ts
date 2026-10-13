import type pg from "pg";
import { pool } from "../../db/pool.js";

export interface CreateAuditEntryParams {
  actorType: "admin" | "worker" | "customer" | "system";
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  entityType?: "customer" | "worker" | "group" | "transaction" | "admin_user" | null;
  entityId?: string | null;
  oldStatus?: string | null;
  newStatus?: string | null;
  reason?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditLogRow {
  id: string;
  actor_type: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_status: string | null;
  new_status: string | null;
  reason: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  total_count?: string | number;
}

export interface FindAuditLogsParams {
  page: number;
  limit: number;
  action?: string;
  actorType?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  reason?: string;
  from?: Date;
  to?: Date;
}

export class AuditRepository {
  async insertEntry(
    params: CreateAuditEntryParams,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<string> {
    const query = `
      INSERT INTO audit_logs (
        actor_type, actor_id, actor_name, action,
        entity_type, entity_id, old_status, new_status,
        reason, old_value, new_value, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id;
    `;

    const values = [
      params.actorType,
      params.actorId || null,
      params.actorName || null,
      params.action,
      params.entityType || null,
      params.entityId || null,
      params.oldStatus || null,
      params.newStatus || null,
      params.reason || null,
      params.oldValue ? JSON.stringify(params.oldValue) : null,
      params.newValue ? JSON.stringify(params.newValue) : null,
      params.ipAddress || null,
      params.userAgent || null,
    ];

    const result = await client.query(query, values);
    return result.rows[0].id;
  }

  async findAuditLogs(
    params: FindAuditLogsParams,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<{ rows: AuditLogRow[]; total: number }> {
    const conditions: string[] = ["1=1"];
    const values: unknown[] = [];
    let idx = 1;

    if (params.action) {
      conditions.push(`action = $${idx++}`);
      values.push(params.action);
    }
    if (params.actorType) {
      conditions.push(`actor_type = $${idx++}`);
      values.push(params.actorType);
    }
    if (params.actorId) {
      conditions.push(`actor_id = $${idx++}`);
      values.push(params.actorId);
    }
    if (params.entityType) {
      conditions.push(`entity_type = $${idx++}`);
      values.push(params.entityType);
    }
    if (params.entityId) {
      conditions.push(`entity_id = $${idx++}`);
      values.push(params.entityId);
    }
    if (params.reason) {
      conditions.push(`reason = $${idx++}`);
      values.push(params.reason);
    }
    if (params.from) {
      conditions.push(`created_at >= $${idx++}`);
      values.push(params.from);
    }
    if (params.to) {
      conditions.push(`created_at <= $${idx++}`);
      values.push(params.to);
    }

    const offset = (params.page - 1) * params.limit;
    values.push(params.limit);
    const limitIdx = idx++;
    values.push(offset);
    const offsetIdx = idx++;

    const query = `
      SELECT 
        id, actor_type, actor_id, actor_name, action,
        entity_type, entity_id, old_status, new_status,
        reason, old_value, new_value, ip_address, user_agent,
        created_at,
        COUNT(*) OVER() AS total_count
      FROM audit_logs
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const result = await client.query(query, values);
    const total = result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    return { rows: result.rows, total };
  }
}

export const auditRepository = new AuditRepository();
