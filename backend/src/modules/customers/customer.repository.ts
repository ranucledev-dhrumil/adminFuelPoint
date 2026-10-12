import type pg from "pg";
import { pool } from "../../db/pool.js";

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  vehicle: string | null;
  qr_token: string;
  group_id: string;
  status: "active" | "inactive";
  registered_at: Date;
  last_activity_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CustomerListItemRow extends CustomerRow {
  group_name: string;
  transactions: number | string;
  total_spend: string;
  discount_received: string;
}

export interface CustomerTransactionRow {
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
  worker_id: string;
  worker_name: string | null;
}

export interface ListCustomersParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sort_by?: string;
  order?: "asc" | "desc" | "ASC" | "DESC";
  q?: string;
  status?: "active" | "inactive";
  groupId?: string;
  group_id?: string;
}

export interface CreateCustomerParams {
  name: string;
  phone: string;
  email?: string | null;
  vehicle?: string | null;
  groupId: string;
  qrToken: string;
}

export interface UpdateCustomerParams {
  name?: string;
  phone?: string;
  email?: string | null;
  vehicle?: string | null;
}

export class CustomerRepository {
  async list(
    params: ListCustomersParams,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<{ rows: CustomerListItemRow[]; total: number }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(100, params.limit ?? 20));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = ["c.deleted_at IS NULL"];
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    if (params.q && params.q.trim()) {
      const search = `%${params.q.trim()}%`;
      whereClauses.push(
        `(c.name ILIKE $${paramIndex} OR c.phone ILIKE $${paramIndex} OR (c.email IS NOT NULL AND c.email ILIKE $${paramIndex}) OR (c.vehicle IS NOT NULL AND c.vehicle ILIKE $${paramIndex}))`,
      );
      queryParams.push(search);
      paramIndex++;
    }

    if (params.status) {
      whereClauses.push(`c.status = $${paramIndex}`);
      queryParams.push(params.status);
      paramIndex++;
    }

    const targetGroupId = params.groupId ?? params.group_id;
    if (targetGroupId) {
      whereClauses.push(`c.group_id = $${paramIndex}`);
      queryParams.push(targetGroupId);
      paramIndex++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // Total count query
    const countQuery = `
      SELECT COUNT(c.id)::int AS total
      FROM customers c
      ${whereSql};
    `;
    const countRes = await client.query<{ total: number }>(countQuery, queryParams);
    const total = countRes.rows[0]?.total ?? 0;

    // Sorting
    const sortField = params.sort_by ?? params.sortBy ?? "registeredAt";
    const sortDirection = (params.order ?? "desc").toUpperCase() === "ASC" ? "ASC" : "DESC";

    let sortExpression = "c.registered_at";
    if (sortField === "name") sortExpression = "c.name";
    else if (sortField === "lastActivity") sortExpression = "c.last_activity_at";
    else if (sortField === "transactions") sortExpression = "transactions";
    else if (sortField === "totalSpend") sortExpression = "total_spend";
    else if (sortField === "discountReceived") sortExpression = "discount_received";
    else if (sortField === "status") sortExpression = "c.status";

    const dataQuery = `
      SELECT
        c.id,
        c.name,
        c.phone,
        c.email,
        c.vehicle,
        c.qr_token,
        c.group_id,
        c.status,
        c.registered_at,
        c.last_activity_at,
        c.created_at,
        c.updated_at,
        c.deleted_at,
        g.name AS group_name,
        COUNT(t.id) FILTER (WHERE t.status = 'success')::int AS transactions,
        COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'success'), 0)::numeric(12,2) AS total_spend,
        COALESCE(SUM(t.discount_amount) FILTER (WHERE t.status = 'success'), 0)::numeric(12,2) AS discount_received
      FROM customers c
      JOIN groups g ON g.id = c.group_id
      LEFT JOIN transactions t ON t.customer_id = c.id
      ${whereSql}
      GROUP BY c.id, g.name
      ORDER BY ${sortExpression} ${sortDirection} NULLS LAST, c.id DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const dataParams = [...queryParams, limit, offset];
    const dataRes = await client.query<CustomerListItemRow>(dataQuery, dataParams);

    return { rows: dataRes.rows, total };
  }

  async findById(
    id: string,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<
    | (CustomerRow & {
        group_name: string;
        transactions: number | string;
        total_spend: string;
        discount_received: string;
      })
    | null
  > {
    const query = `
      SELECT
        c.id,
        c.name,
        c.phone,
        c.email,
        c.vehicle,
        c.qr_token,
        c.group_id,
        c.status,
        c.registered_at,
        c.last_activity_at,
        c.created_at,
        c.updated_at,
        c.deleted_at,
        g.name AS group_name,
        COUNT(t.id) FILTER (WHERE t.status = 'success')::int AS transactions,
        COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'success'), 0)::numeric(12,2) AS total_spend,
        COALESCE(SUM(t.discount_amount) FILTER (WHERE t.status = 'success'), 0)::numeric(12,2) AS discount_received
      FROM customers c
      JOIN groups g ON g.id = c.group_id
      LEFT JOIN transactions t ON t.customer_id = c.id
      WHERE c.id = $1 AND c.deleted_at IS NULL
      GROUP BY c.id, g.name;
    `;
    const result = await client.query(query, [id]);
    return result.rows[0] ?? null;
  }

  async findByIdForUpdate(id: string, client: pg.PoolClient): Promise<CustomerRow | null> {
    const query = `
      SELECT *
      FROM customers
      WHERE id = $1 AND deleted_at IS NULL
      FOR UPDATE;
    `;
    const result = await client.query<CustomerRow>(query, [id]);
    return result.rows[0] ?? null;
  }

  async findByPhone(
    phone: string,
    excludeId?: string,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<CustomerRow | null> {
    let query: string;
    let params: unknown[];

    if (excludeId) {
      query = `
        SELECT *
        FROM customers
        WHERE phone = $1 AND id != $2 AND deleted_at IS NULL
        LIMIT 1;
      `;
      params = [phone, excludeId];
    } else {
      query = `
        SELECT *
        FROM customers
        WHERE phone = $1 AND deleted_at IS NULL
        LIMIT 1;
      `;
      params = [phone];
    }

    const result = await client.query<CustomerRow>(query, params);
    return result.rows[0] ?? null;
  }

  async findByEmail(
    email: string,
    excludeId?: string,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<CustomerRow | null> {
    let query: string;
    let params: unknown[];

    if (excludeId) {
      query = `
        SELECT *
        FROM customers
        WHERE email = $1 AND id != $2 AND deleted_at IS NULL
        LIMIT 1;
      `;
      params = [email, excludeId];
    } else {
      query = `
        SELECT *
        FROM customers
        WHERE email = $1 AND deleted_at IS NULL
        LIMIT 1;
      `;
      params = [email];
    }

    const result = await client.query<CustomerRow>(query, params);
    return result.rows[0] ?? null;
  }

  async getRecentTransactions(
    customerId: string,
    limit = 10,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<CustomerTransactionRow[]> {
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
        t.worker_id,
        w.name AS worker_name
      FROM transactions t
      LEFT JOIN workers w ON w.id = t.worker_id
      WHERE t.customer_id = $1
      ORDER BY t.submitted_at DESC
      LIMIT $2;
    `;
    const result = await client.query<CustomerTransactionRow>(query, [customerId, limit]);
    return result.rows;
  }

  async create(params: CreateCustomerParams, client: pg.PoolClient): Promise<CustomerRow> {
    const query = `
      INSERT INTO customers (
        name,
        phone,
        email,
        vehicle,
        qr_token,
        group_id,
        status,
        registered_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'active', now())
      RETURNING *;
    `;
    const result = await client.query<CustomerRow>(query, [
      params.name.trim(),
      params.phone,
      params.email !== undefined ? params.email : null,
      params.vehicle !== undefined ? params.vehicle : null,
      params.qrToken,
      params.groupId,
    ]);
    return result.rows[0];
  }

  async update(
    id: string,
    params: UpdateCustomerParams,
    client: pg.PoolClient,
  ): Promise<CustomerRow> {
    const setClauses: string[] = [];
    const values: unknown[] = [id];
    let paramIndex = 2;

    if (params.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(params.name.trim());
    }

    if (params.phone !== undefined) {
      setClauses.push(`phone = $${paramIndex++}`);
      values.push(params.phone);
    }

    if (params.email !== undefined) {
      setClauses.push(`email = $${paramIndex++}`);
      values.push(params.email);
    }

    if (params.vehicle !== undefined) {
      setClauses.push(`vehicle = $${paramIndex++}`);
      values.push(params.vehicle);
    }

    setClauses.push("updated_at = now()");

    const query = `
      UPDATE customers
      SET ${setClauses.join(", ")}
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;
    const result = await client.query<CustomerRow>(query, values);
    return result.rows[0];
  }

  async updateStatus(
    id: string,
    status: "active" | "inactive",
    client: pg.PoolClient,
  ): Promise<CustomerRow> {
    const query = `
      UPDATE customers
      SET status = $2, updated_at = now()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;
    const result = await client.query<CustomerRow>(query, [id, status]);
    return result.rows[0];
  }

  async updateGroup(id: string, groupId: string, client: pg.PoolClient): Promise<CustomerRow> {
    const query = `
      UPDATE customers
      SET group_id = $2, updated_at = now()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;
    const result = await client.query<CustomerRow>(query, [id, groupId]);
    return result.rows[0];
  }

  async softDelete(id: string, client: pg.PoolClient): Promise<void> {
    const query = `
      UPDATE customers
      SET deleted_at = now(), updated_at = now()
      WHERE id = $1;
    `;
    await client.query(query, [id]);
  }

  async revokeRefreshTokens(customerId: string, client: pg.PoolClient): Promise<number> {
    const query = `
      UPDATE refresh_tokens
      SET revoked_at = now()
      WHERE customer_id = $1 AND revoked_at IS NULL;
    `;
    const result = await client.query(query, [customerId]);
    return result.rowCount ?? 0;
  }
}

export const customerRepository = new CustomerRepository();
