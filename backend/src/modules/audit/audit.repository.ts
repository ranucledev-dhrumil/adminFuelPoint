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
}

export const auditRepository = new AuditRepository();
