import type pg from "pg";
import { pool } from "../../db/pool.js";

export type WorkerShift = "Morning" | "Evening" | "Night";
export type WorkerStatus = "active" | "offline" | "suspended";

export interface WorkerRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  shift: WorkerShift;
  status: WorkerStatus;
  joined_at: Date;
  first_login_at: Date | null;
  last_activity_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface WorkerListItemRow extends WorkerRow {
  scans: number | string;
  transactions: number | string;
  customers_scanned: number | string;
  discount_processed: string;
}

export interface WorkerTransactionRow {
  id: string;
  status: "pending" | "success" | "failed";
  amount: string;
  discount_percent: string;
  discount_amount: string;
  net_payable: string;
  fuel_type: string | null;
  litres: string | null;
  submitted_at: Date;
  resolved_at: Date | null;
  customer_id: string;
  customer_name: string | null;
}

export interface ListWorkersParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sort_by?: string;
  order?: "asc" | "desc" | "ASC" | "DESC";
  q?: string;
  status?: WorkerStatus;
  shift?: WorkerShift;
}

export interface CreateWorkerParams {
  name: string;
  email: string;
  phone: string;
  shift: WorkerShift;
  status?: WorkerStatus;
}

export interface UpdateWorkerParams {
  name?: string;
  email?: string;
  phone?: string;
  shift?: WorkerShift;
}

export class WorkerRepository {
  async list(
    params: ListWorkersParams,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<{ rows: WorkerListItemRow[]; total: number }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(100, params.limit ?? 20));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = ["w.deleted_at IS NULL"];
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    if (params.q && params.q.trim()) {
      const search = `%${params.q.trim()}%`;
      whereClauses.push(
        `(w.name ILIKE $${paramIndex} OR w.phone ILIKE $${paramIndex} OR w.email ILIKE $${paramIndex})`,
      );
      queryParams.push(search);
      paramIndex++;
    }

    if (params.status) {
      whereClauses.push(`w.status = $${paramIndex}`);
      queryParams.push(params.status);
      paramIndex++;
    }

    if (params.shift) {
      whereClauses.push(`w.shift = $${paramIndex}`);
      queryParams.push(params.shift);
      paramIndex++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // Total count query
    const countQuery = `
      SELECT COUNT(w.id)::int AS total
      FROM workers w
      ${whereSql};
    `;
    const countRes = await client.query<{ total: number }>(countQuery, queryParams);
    const total = countRes.rows[0]?.total ?? 0;

    // Sorting
    const sortField = params.sort_by ?? params.sortBy ?? "joinedAt";
    const sortDirection = (params.order ?? "desc").toUpperCase() === "ASC" ? "ASC" : "DESC";

    let sortExpression = "w.joined_at";
    if (sortField === "name") sortExpression = "w.name";
    else if (sortField === "lastActivity") sortExpression = "w.last_activity_at";
    else if (sortField === "scans") sortExpression = "scans";
    else if (sortField === "transactions") sortExpression = "transactions";
    else if (sortField === "customersScanned") sortExpression = "customers_scanned";
    else if (sortField === "discountProcessed") sortExpression = "discount_processed";
    else if (sortField === "status") sortExpression = "w.status";
    else if (sortField === "shift") sortExpression = "w.shift";

    const dataQuery = `
      SELECT
        w.id,
        w.name,
        w.email,
        w.phone,
        w.shift,
        w.status,
        w.joined_at,
        w.first_login_at,
        w.last_activity_at,
        w.created_at,
        w.updated_at,
        w.deleted_at,
        COUNT(t.id)::int AS scans,
        COUNT(t.id) FILTER (WHERE t.status = 'success')::int AS transactions,
        COUNT(DISTINCT t.customer_id) FILTER (WHERE t.status = 'success')::int AS customers_scanned,
        COALESCE(SUM(t.discount_amount) FILTER (WHERE t.status = 'success'), 0)::numeric(12,2) AS discount_processed
      FROM workers w
      LEFT JOIN transactions t ON t.worker_id = w.id
      ${whereSql}
      GROUP BY w.id
      ORDER BY ${sortExpression} ${sortDirection} NULLS LAST, w.id DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const dataParams = [...queryParams, limit, offset];
    const dataRes = await client.query<WorkerListItemRow>(dataQuery, dataParams);

    return { rows: dataRes.rows, total };
  }

  async findById(
    id: string,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<WorkerListItemRow | null> {
    const query = `
      SELECT
        w.id,
        w.name,
        w.email,
        w.phone,
        w.shift,
        w.status,
        w.joined_at,
        w.first_login_at,
        w.last_activity_at,
        w.created_at,
        w.updated_at,
        w.deleted_at,
        COUNT(t.id)::int AS scans,
        COUNT(t.id) FILTER (WHERE t.status = 'success')::int AS transactions,
        COUNT(DISTINCT t.customer_id) FILTER (WHERE t.status = 'success')::int AS customers_scanned,
        COALESCE(SUM(t.discount_amount) FILTER (WHERE t.status = 'success'), 0)::numeric(12,2) AS discount_processed
      FROM workers w
      LEFT JOIN transactions t ON t.worker_id = w.id
      WHERE w.id = $1 AND w.deleted_at IS NULL
      GROUP BY w.id;
    `;
    const result = await client.query<WorkerListItemRow>(query, [id]);
    return result.rows[0] ?? null;
  }

  async findByIdForUpdate(id: string, client: pg.PoolClient): Promise<WorkerRow | null> {
    const query = `
      SELECT *
      FROM workers
      WHERE id = $1 AND deleted_at IS NULL
      FOR UPDATE;
    `;
    const result = await client.query<WorkerRow>(query, [id]);
    return result.rows[0] ?? null;
  }

  async findByPhone(
    phone: string,
    excludeId?: string,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<WorkerRow | null> {
    let query: string;
    let params: unknown[];

    if (excludeId) {
      query = `
        SELECT *
        FROM workers
        WHERE phone = $1 AND id != $2 AND deleted_at IS NULL
        LIMIT 1;
      `;
      params = [phone, excludeId];
    } else {
      query = `
        SELECT *
        FROM workers
        WHERE phone = $1 AND deleted_at IS NULL
        LIMIT 1;
      `;
      params = [phone];
    }

    const result = await client.query<WorkerRow>(query, params);
    return result.rows[0] ?? null;
  }

  async findByEmail(
    email: string,
    excludeId?: string,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<WorkerRow | null> {
    let query: string;
    let params: unknown[];

    if (excludeId) {
      query = `
        SELECT *
        FROM workers
        WHERE email = $1 AND id != $2 AND deleted_at IS NULL
        LIMIT 1;
      `;
      params = [email, excludeId];
    } else {
      query = `
        SELECT *
        FROM workers
        WHERE email = $1 AND deleted_at IS NULL
        LIMIT 1;
      `;
      params = [email];
    }

    const result = await client.query<WorkerRow>(query, params);
    return result.rows[0] ?? null;
  }

  async getRecentTransactions(
    workerId: string,
    limit = 10,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<WorkerTransactionRow[]> {
    const query = `
      SELECT
        t.id,
        t.status,
        t.amount,
        t.discount_percent,
        t.discount_amount,
        (t.amount - t.discount_amount)::numeric(12,2) AS net_payable,
        t.fuel_type,
        t.litres,
        t.submitted_at,
        t.resolved_at,
        t.customer_id,
        c.name AS customer_name
      FROM transactions t
      LEFT JOIN customers c ON c.id = t.customer_id
      WHERE t.worker_id = $1
      ORDER BY t.submitted_at DESC
      LIMIT $2;
    `;
    const result = await client.query<WorkerTransactionRow>(query, [workerId, limit]);
    return result.rows;
  }

  async create(params: CreateWorkerParams, client: pg.PoolClient): Promise<WorkerRow> {
    const query = `
      INSERT INTO workers (
        name,
        email,
        phone,
        shift,
        status,
        joined_at
      )
      VALUES ($1, $2, $3, $4, $5, now())
      RETURNING *;
    `;
    const result = await client.query<WorkerRow>(query, [
      params.name.trim(),
      params.email,
      params.phone,
      params.shift,
      params.status ?? "active",
    ]);
    return result.rows[0];
  }

  async update(id: string, params: UpdateWorkerParams, client: pg.PoolClient): Promise<WorkerRow> {
    const setClauses: string[] = [];
    const values: unknown[] = [id];
    let paramIndex = 2;

    if (params.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(params.name.trim());
    }

    if (params.email !== undefined) {
      setClauses.push(`email = $${paramIndex++}`);
      values.push(params.email);
    }

    if (params.phone !== undefined) {
      setClauses.push(`phone = $${paramIndex++}`);
      values.push(params.phone);
    }

    if (params.shift !== undefined) {
      setClauses.push(`shift = $${paramIndex++}`);
      values.push(params.shift);
    }

    setClauses.push("updated_at = now()");

    const query = `
      UPDATE workers
      SET ${setClauses.join(", ")}
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;
    const result = await client.query<WorkerRow>(query, values);
    return result.rows[0];
  }

  async updateStatus(id: string, status: WorkerStatus, client: pg.PoolClient): Promise<WorkerRow> {
    const query = `
      UPDATE workers
      SET status = $2, updated_at = now()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;
    const result = await client.query<WorkerRow>(query, [id, status]);
    return result.rows[0];
  }

  async softDelete(id: string, client: pg.PoolClient): Promise<void> {
    const query = `
      UPDATE workers
      SET deleted_at = now(), updated_at = now()
      WHERE id = $1;
    `;
    await client.query(query, [id]);
  }

  async revokeRefreshTokens(workerId: string, client: pg.PoolClient): Promise<number> {
    const query = `
      UPDATE refresh_tokens
      SET revoked_at = now()
      WHERE worker_id = $1 AND revoked_at IS NULL;
    `;
    const result = await client.query(query, [workerId]);
    return result.rowCount ?? 0;
  }
}

export const workerRepository = new WorkerRepository();
