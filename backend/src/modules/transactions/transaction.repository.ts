import type pg from "pg";
import { pool } from "../../db/pool.js";

export type TransactionStatus = "pending" | "success" | "failed";
export type FuelType = "Petrol" | "Diesel" | "CNG";

export interface TransactionRow {
  id: string;
  customer_id: string;
  worker_id: string;
  group_id: string;
  status: TransactionStatus;
  amount: string | number;
  discount_percent: string | number;
  discount_amount: string | number;
  litres: string | number | null;
  fuel_type: FuelType | null;
  failure_reason: string | null;
  submitted_at: Date;
  resolved_at: Date | null;
  updated_at: Date;
  customer_name?: string;
  customer_phone?: string;
  worker_name?: string;
  group_name?: string;
  total_count?: string | number;
}

export interface CustomerScanRow {
  id: string;
  name: string;
  phone: string;
  status: "active" | "inactive";
  group_id: string;
  group_name: string;
  discount_percent: string | number;
  group_active: boolean;
}

export interface StatusHistoryRow {
  id: string;
  old_status: string | null;
  new_status: string | null;
  actor_type: string;
  actor_id: string | null;
  actor_name: string | null;
  reason: string | null;
  created_at: Date;
}

export interface CreateTransactionData {
  id: string;
  customerId: string;
  workerId: string;
  groupId: string;
  amount: string;
  discountPercent: string;
  discountAmount: string;
  litres?: string | null;
  fuelType?: FuelType | null;
}

export interface AdminListTransactionsParams {
  page: number;
  limit: number;
  sort_by: "submitted_at" | "amount" | "discount_amount" | "status";
  order: "asc" | "desc";
  status?: TransactionStatus;
  customerId?: string;
  workerId?: string;
  groupId?: string;
  from?: Date;
  to?: Date;
  q?: string;
}

export interface WorkerListTransactionsParams {
  page: number;
  limit: number;
  sort_by: "submitted_at" | "amount" | "discount_amount" | "status";
  order: "asc" | "desc";
  status?: TransactionStatus;
  from?: Date;
  to?: Date;
}

export interface CustomerListTransactionsParams {
  page: number;
  limit: number;
  sort_by: "submitted_at" | "amount" | "discount_amount" | "status";
  order: "asc" | "desc";
}

export class TransactionRepository {
  async findCustomerByQrToken(
    qrToken: string,
    client: pg.PoolClient | pg.Pool = pool,
  ): Promise<CustomerScanRow | null> {
    const query = `
      SELECT 
        c.id, 
        c.name, 
        c.phone, 
        c.status, 
        c.group_id,
        COALESCE(g.name, 'Default') AS group_name,
        COALESCE(g.discount_percent, 0.00) AS discount_percent,
        COALESCE(g.active, false) AS group_active
      FROM customers c
      LEFT JOIN groups g ON g.id = c.group_id AND g.deleted_at IS NULL
      WHERE c.qr_token = $1 AND c.deleted_at IS NULL
    `;
    const result = await client.query(query, [qrToken]);
    return result.rows[0] || null;
  }

  async findCustomerById(
    id: string,
    client: pg.PoolClient | pg.Pool = pool,
  ): Promise<{ id: string; name: string; phone: string; status: string; group_id: string } | null> {
    const query = `
      SELECT id, name, phone, status, group_id
      FROM customers
      WHERE id = $1 AND deleted_at IS NULL
    `;
    const result = await client.query(query, [id]);
    return result.rows[0] || null;
  }

  async findWorkerById(
    id: string,
    client: pg.PoolClient | pg.Pool = pool,
  ): Promise<{ id: string; name: string; phone: string; email: string; status: string } | null> {
    const query = `
      SELECT id, name, phone, email, status
      FROM workers
      WHERE id = $1 AND deleted_at IS NULL
    `;
    const result = await client.query(query, [id]);
    return result.rows[0] || null;
  }

  async findAdminById(
    id: string,
    client: pg.PoolClient | pg.Pool = pool,
  ): Promise<{ id: string; name: string; email: string } | null> {
    const query = `
      SELECT id, name, email
      FROM admin_users
      WHERE id = $1
    `;
    const result = await client.query(query, [id]);
    return result.rows[0] || null;
  }

  async findById(
    id: string,
    client: pg.PoolClient | pg.Pool = pool,
  ): Promise<TransactionRow | null> {
    const query = `
      SELECT 
        t.*,
        c.name AS customer_name,
        c.phone AS customer_phone,
        w.name AS worker_name,
        g.name AS group_name
      FROM transactions t
      JOIN customers c ON c.id = t.customer_id
      JOIN workers w ON w.id = t.worker_id
      JOIN groups g ON g.id = t.group_id
      WHERE t.id = $1
    `;
    const result = await client.query(query, [id]);
    return result.rows[0] || null;
  }

  async lockForUpdate(id: string, client: pg.PoolClient): Promise<TransactionRow | null> {
    const query = `
      SELECT *
      FROM transactions
      WHERE id = $1
      FOR UPDATE
    `;
    const result = await client.query(query, [id]);
    return result.rows[0] || null;
  }

  async create(data: CreateTransactionData, client: pg.PoolClient): Promise<TransactionRow> {
    const query = `
      INSERT INTO transactions (
        id, customer_id, worker_id, group_id, status,
        amount, discount_percent, discount_amount, litres, fuel_type,
        submitted_at
      )
      VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9, now())
      RETURNING *
    `;
    const values = [
      data.id,
      data.customerId,
      data.workerId,
      data.groupId,
      data.amount,
      data.discountPercent,
      data.discountAmount,
      data.litres || null,
      data.fuelType || null,
    ];
    const result = await client.query(query, values);
    return result.rows[0];
  }

  async updateWorkerLastActivity(workerId: string, client: pg.PoolClient): Promise<void> {
    const query = `
      UPDATE workers
      SET last_activity_at = now()
      WHERE id = $1
    `;
    await client.query(query, [workerId]);
  }

  async updateStatus(
    id: string,
    status: TransactionStatus,
    failureReason: string | null,
    resolvedAt: Date | null,
    client: pg.PoolClient,
  ): Promise<TransactionRow> {
    const query = `
      UPDATE transactions
      SET 
        status = $1,
        failure_reason = $2,
        resolved_at = COALESCE(resolved_at, $3)
      WHERE id = $4
      RETURNING *
    `;
    const result = await client.query(query, [status, failureReason, resolvedAt, id]);
    return result.rows[0];
  }

  async recalculateCustomerLastActivity(customerId: string, client: pg.PoolClient): Promise<void> {
    const query = `
      UPDATE customers
      SET last_activity_at = (
        SELECT MAX(submitted_at)
        FROM transactions
        WHERE customer_id = customers.id AND status = 'success'
      )
      WHERE id = $1
    `;
    await client.query(query, [customerId]);
  }

  async listAdminTransactions(
    params: AdminListTransactionsParams,
    client: pg.PoolClient | pg.Pool = pool,
  ): Promise<{ rows: TransactionRow[]; total: number }> {
    const conditions: string[] = ["1=1"];
    const values: unknown[] = [];
    let idx = 1;

    if (params.status) {
      conditions.push(`t.status = $${idx++}`);
      values.push(params.status);
    }
    if (params.customerId) {
      conditions.push(`t.customer_id = $${idx++}`);
      values.push(params.customerId);
    }
    if (params.workerId) {
      conditions.push(`t.worker_id = $${idx++}`);
      values.push(params.workerId);
    }
    if (params.groupId) {
      conditions.push(`t.group_id = $${idx++}`);
      values.push(params.groupId);
    }
    if (params.from) {
      conditions.push(`t.submitted_at >= $${idx++}`);
      values.push(params.from);
    }
    if (params.to) {
      conditions.push(`t.submitted_at <= $${idx++}`);
      values.push(params.to);
    }
    if (params.q) {
      conditions.push(
        `(c.name ILIKE $${idx} OR w.name ILIKE $${idx} OR c.phone ILIKE $${idx} OR w.phone ILIKE $${idx} OR t.id::text ILIKE $${idx} OR t.fuel_type::text ILIKE $${idx})`,
      );
      values.push(`%${params.q}%`);
      idx++;
    }

    const sortColumnMap: Record<string, string> = {
      submitted_at: "t.submitted_at",
      amount: "t.amount",
      discount_amount: "t.discount_amount",
      status: "t.status",
    };
    const sortCol = sortColumnMap[params.sort_by] || "t.submitted_at";
    const sortOrder = params.order.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const offset = (params.page - 1) * params.limit;
    values.push(params.limit);
    const limitIdx = idx++;
    values.push(offset);
    const offsetIdx = idx++;

    const query = `
      SELECT 
        t.*,
        c.name AS customer_name,
        w.name AS worker_name,
        g.name AS group_name,
        COUNT(*) OVER() AS total_count
      FROM transactions t
      JOIN customers c ON c.id = t.customer_id
      JOIN workers w ON w.id = t.worker_id
      JOIN groups g ON g.id = t.group_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY ${sortCol} ${sortOrder}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const result = await client.query(query, values);
    const total = result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    return { rows: result.rows, total };
  }

  async listWorkerTransactions(
    workerId: string,
    params: WorkerListTransactionsParams,
    client: pg.PoolClient | pg.Pool = pool,
  ): Promise<{ rows: TransactionRow[]; total: number }> {
    const conditions: string[] = ["t.worker_id = $1"];
    const values: unknown[] = [workerId];
    let idx = 2;

    if (params.status) {
      conditions.push(`t.status = $${idx++}`);
      values.push(params.status);
    }
    if (params.from) {
      conditions.push(`t.submitted_at >= $${idx++}`);
      values.push(params.from);
    }
    if (params.to) {
      conditions.push(`t.submitted_at <= $${idx++}`);
      values.push(params.to);
    }

    const sortColumnMap: Record<string, string> = {
      submitted_at: "t.submitted_at",
      amount: "t.amount",
      discount_amount: "t.discount_amount",
      status: "t.status",
    };
    const sortCol = sortColumnMap[params.sort_by] || "t.submitted_at";
    const sortOrder = params.order.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const offset = (params.page - 1) * params.limit;
    values.push(params.limit);
    const limitIdx = idx++;
    values.push(offset);
    const offsetIdx = idx++;

    const query = `
      SELECT 
        t.*,
        c.name AS customer_name,
        COUNT(*) OVER() AS total_count
      FROM transactions t
      JOIN customers c ON c.id = t.customer_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY ${sortCol} ${sortOrder}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const result = await client.query(query, values);
    const total = result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    return { rows: result.rows, total };
  }

  async listCustomerTransactions(
    customerId: string,
    params: CustomerListTransactionsParams,
    client: pg.PoolClient | pg.Pool = pool,
  ): Promise<{ rows: TransactionRow[]; total: number }> {
    const sortColumnMap: Record<string, string> = {
      submitted_at: "t.submitted_at",
      amount: "t.amount",
      discount_amount: "t.discount_amount",
      status: "t.status",
    };
    const sortCol = sortColumnMap[params.sort_by] || "t.submitted_at";
    const sortOrder = params.order.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const offset = (params.page - 1) * params.limit;
    const values: unknown[] = [customerId, params.limit, offset];

    const query = `
      SELECT 
        t.*,
        COUNT(*) OVER() AS total_count
      FROM transactions t
      WHERE t.customer_id = $1
      ORDER BY ${sortCol} ${sortOrder}
      LIMIT $2 OFFSET $3
    `;

    const result = await client.query(query, values);
    const total = result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    return { rows: result.rows, total };
  }

  async getStatusHistory(
    transactionId: string,
    client: pg.PoolClient | pg.Pool = pool,
  ): Promise<StatusHistoryRow[]> {
    const query = `
      SELECT 
        id, 
        old_status, 
        new_status, 
        actor_type, 
        actor_id, 
        actor_name, 
        reason, 
        created_at
      FROM audit_logs
      WHERE entity_type = 'transaction'
        AND entity_id = $1
        AND action = 'transaction.status_changed'
      ORDER BY created_at ASC
    `;
    const result = await client.query(query, [transactionId]);
    return result.rows;
  }
}

export const transactionRepository = new TransactionRepository();
