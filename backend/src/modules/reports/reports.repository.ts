import type pg from "pg";
import { pool } from "../../db/pool.js";
import { DEFAULT_GROUP_ID } from "../../seeds/default-group.seed.js";

export interface OverviewMetricsRow {
  total_customers: string | number;
  active_customers: string | number;
  unassigned_customers: string | number;
  used_pump_customers: string | number;
  new_registrations_7d: string | number;
  total_workers: string | number;
  active_workers: string | number;
  total_groups: string | number;
  total_transactions: string | number;
  total_discount: string | number;
  total_revenue: string | number;
  today_transactions: string | number;
  today_discount: string | number;
}

export interface DayAggRow {
  day_key: string;
  transactions: string | number;
  discount: string | number;
  revenue: string | number;
}

export interface CustomerRegDayRow {
  day_key: string;
  registrations: string | number;
}

export interface WorkerActivityRow {
  id: string;
  name: string;
  scans: string | number;
  transactions: string | number;
}

export interface GroupDistributionRow {
  id: string;
  name: string;
  discount_percent: string | number;
  active: boolean;
  customers: string | number;
  transactions: string | number;
  discount_generated: string | number;
}

export interface GlobalSearchCustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: string;
}

export interface GlobalSearchWorkerRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: string;
}

export class ReportsRepository {
  async getOverviewMetrics(
    todayStart: Date,
    todayEnd: Date,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<OverviewMetricsRow> {
    const query = `
      SELECT
        (SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL) AS total_customers,
        (SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL AND status = 'active') AS active_customers,
        (SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL AND group_id = $1) AS unassigned_customers,
        (SELECT COUNT(DISTINCT customer_id) FROM transactions WHERE status = 'success') AS used_pump_customers,
        (SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL AND registered_at >= now() - interval '7 days') AS new_registrations_7d,
        (SELECT COUNT(*) FROM workers WHERE deleted_at IS NULL) AS total_workers,
        (SELECT COUNT(*) FROM workers WHERE deleted_at IS NULL AND status = 'active') AS active_workers,
        (SELECT COUNT(*) FROM groups WHERE deleted_at IS NULL) AS total_groups,
        (SELECT COUNT(*) FROM transactions WHERE status = 'success') AS total_transactions,
        (SELECT COALESCE(SUM(discount_amount), 0) FROM transactions WHERE status = 'success') AS total_discount,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'success') AS total_revenue,
        (SELECT COUNT(*) FROM transactions WHERE status = 'success' AND submitted_at >= $2 AND submitted_at <= $3) AS today_transactions,
        (SELECT COALESCE(SUM(discount_amount), 0) FROM transactions WHERE status = 'success' AND submitted_at >= $2 AND submitted_at <= $3) AS today_discount
    `;
    const res = await client.query<OverviewMetricsRow>(query, [
      DEFAULT_GROUP_ID,
      todayStart,
      todayEnd,
    ]);
    return res.rows[0];
  }

  async getTransactionDailyAggs(
    start: Date,
    end: Date,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<DayAggRow[]> {
    const query = `
      SELECT
        TO_CHAR(submitted_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day_key,
        COUNT(*) AS transactions,
        COALESCE(SUM(discount_amount), 0) AS discount,
        COALESCE(SUM(amount), 0) AS revenue
      FROM transactions
      WHERE status = 'success'
        AND submitted_at >= $1
        AND submitted_at <= $2
      GROUP BY day_key
    `;
    const res = await client.query<DayAggRow>(query, [start, end]);
    return res.rows;
  }

  async getCustomerRegistrationDailyAggs(
    start: Date,
    end: Date,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<CustomerRegDayRow[]> {
    const query = `
      SELECT
        TO_CHAR(registered_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day_key,
        COUNT(*) AS registrations
      FROM customers
      WHERE deleted_at IS NULL
        AND registered_at >= $1
        AND registered_at <= $2
      GROUP BY day_key
    `;
    const res = await client.query<CustomerRegDayRow>(query, [start, end]);
    return res.rows;
  }

  async getWorkerActivity(client: pg.Pool | pg.PoolClient = pool): Promise<WorkerActivityRow[]> {
    const query = `
      SELECT
        w.id,
        w.name,
        COUNT(t.id) AS scans,
        COUNT(t.id) FILTER (WHERE t.status = 'success') AS transactions
      FROM workers w
      LEFT JOIN transactions t ON t.worker_id = w.id
      WHERE w.deleted_at IS NULL
      GROUP BY w.id, w.name
      ORDER BY scans DESC, transactions DESC
    `;
    const res = await client.query<WorkerActivityRow>(query);
    return res.rows;
  }

  async getGroupDistribution(
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<GroupDistributionRow[]> {
    const query = `
      SELECT
        g.id,
        g.name,
        g.discount_percent,
        g.active,
        COALESCE(c.cust_count, 0) AS customers,
        COALESCE(t.tx_count, 0) AS transactions,
        COALESCE(t.discount_gen, 0) AS discount_generated
      FROM groups g
      LEFT JOIN (
        SELECT group_id, COUNT(*) AS cust_count
        FROM customers
        WHERE deleted_at IS NULL
        GROUP BY group_id
      ) c ON c.group_id = g.id
      LEFT JOIN (
        SELECT group_id, COUNT(*) AS tx_count, SUM(discount_amount) AS discount_gen
        FROM transactions
        WHERE status = 'success'
        GROUP BY group_id
      ) t ON t.group_id = g.id
      WHERE g.deleted_at IS NULL
      ORDER BY g.is_default DESC, g.name ASC
    `;
    const res = await client.query<GroupDistributionRow>(query);
    return res.rows;
  }

  async searchCustomers(
    q: string,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<GlobalSearchCustomerRow[]> {
    const pattern = `%${q}%`;
    const query = `
      SELECT id, name, phone, email, status
      FROM customers
      WHERE deleted_at IS NULL
        AND (name ILIKE $1 OR phone ILIKE $1 OR COALESCE(email, '') ILIKE $1)
      ORDER BY name ASC
      LIMIT 20
    `;
    const res = await client.query<GlobalSearchCustomerRow>(query, [pattern]);
    return res.rows;
  }

  async searchWorkers(
    q: string,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<GlobalSearchWorkerRow[]> {
    const pattern = `%${q}%`;
    const query = `
      SELECT id, name, phone, email, status
      FROM workers
      WHERE deleted_at IS NULL
        AND (name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1)
      ORDER BY name ASC
      LIMIT 20
    `;
    const res = await client.query<GlobalSearchWorkerRow>(query, [pattern]);
    return res.rows;
  }

  async getTransactionsSummaryMetrics(
    from: Date,
    to: Date,
    status?: "all" | "pending" | "success" | "failed" | undefined,
    q?: string | undefined,
    client: pg.Pool | pg.PoolClient = pool,
  ) {
    const conditions: string[] = ["t.submitted_at >= $1", "t.submitted_at <= $2"];
    const params: unknown[] = [from, to];

    if (status && status !== "all") {
      params.push(status);
      conditions.push(`t.status = $${params.length}`);
    } else if (!status) {
      conditions.push("t.status = 'success'");
    }

    if (q && q.trim()) {
      params.push(`%${q.trim()}%`);
      const idx = params.length;
      conditions.push(
        `(c.name ILIKE $${idx} OR w.name ILIKE $${idx} OR c.phone ILIKE $${idx} OR w.phone ILIKE $${idx} OR t.id::text ILIKE $${idx} OR t.fuel_type::text ILIKE $${idx})`,
      );
    }

    const query = `
      SELECT
        COUNT(t.id) AS count,
        COALESCE(SUM(t.amount), 0) AS revenue,
        COALESCE(SUM(t.litres), 0) AS litres,
        COALESCE(SUM(t.discount_amount), 0) AS discount,
        COUNT(t.id) FILTER (WHERE t.discount_amount > 0) AS discounted_scans
      FROM transactions t
      LEFT JOIN customers c ON c.id = t.customer_id
      LEFT JOIN workers w ON w.id = t.worker_id
      WHERE ${conditions.join(" AND ")}
    `;
    const res = await client.query(query, params);
    return res.rows[0];
  }

  async getCustomerRegistrationsCount(
    from: Date,
    to: Date,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<number> {
    const query = `
      SELECT COUNT(*) AS count
      FROM customers
      WHERE deleted_at IS NULL
        AND registered_at >= $1
        AND registered_at <= $2
    `;
    const res = await client.query(query, [from, to]);
    return Number(res.rows[0]?.count || 0);
  }

  async getWorkerScansCount(
    from: Date,
    to: Date,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<number> {
    const query = `
      SELECT COUNT(*) AS count
      FROM transactions
      WHERE submitted_at >= $1
        AND submitted_at <= $2
    `;
    const res = await client.query(query, [from, to]);
    return Number(res.rows[0]?.count || 0);
  }

  async getExportTransactions(
    from: Date,
    to: Date,
    status?: string | undefined,
    q?: string | undefined,
    client: pg.Pool | pg.PoolClient = pool,
  ) {
    const conditions: string[] = ["t.submitted_at >= $1", "t.submitted_at <= $2"];
    const params: unknown[] = [from, to];

    if (status && status !== "all") {
      params.push(status);
      conditions.push(`t.status = $${params.length}`);
    } else if (!status) {
      conditions.push("t.status = 'success'");
    }

    if (q && q.trim()) {
      params.push(`%${q.trim()}%`);
      const idx = params.length;
      conditions.push(
        `(c.name ILIKE $${idx} OR w.name ILIKE $${idx} OR c.phone ILIKE $${idx} OR w.phone ILIKE $${idx} OR t.id::text ILIKE $${idx} OR t.fuel_type::text ILIKE $${idx})`,
      );
    }

    const query = `
      SELECT 
        t.id,
        t.submitted_at,
        c.name AS customer_name,
        w.name AS worker_name,
        t.fuel_type,
        t.litres,
        t.amount,
        t.discount_percent,
        t.discount_amount
      FROM transactions t
      JOIN customers c ON c.id = t.customer_id
      JOIN workers w ON w.id = t.worker_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY t.submitted_at ASC
      LIMIT 100000
    `;
    const res = await client.query(query, params);
    return res.rows;
  }

  async getExportCustomers(from: Date, to: Date, client: pg.Pool | pg.PoolClient = pool) {
    const query = `
      SELECT 
        c.id,
        c.name,
        c.phone,
        g.name AS group_name,
        c.registered_at,
        COUNT(t.id) FILTER (WHERE t.status = 'success') AS transactions,
        COALESCE(SUM(t.discount_amount) FILTER (WHERE t.status = 'success'), 0) AS discount_received
      FROM customers c
      LEFT JOIN groups g ON g.id = c.group_id
      LEFT JOIN transactions t ON t.customer_id = c.id
      WHERE c.deleted_at IS NULL
        AND c.registered_at >= $1
        AND c.registered_at <= $2
      GROUP BY c.id, c.name, c.phone, g.name, c.registered_at
      ORDER BY c.registered_at ASC
      LIMIT 100000
    `;
    const res = await client.query(query, [from, to]);
    return res.rows;
  }

  async getExportWorkers(client: pg.Pool | pg.PoolClient = pool) {
    const query = `
      SELECT 
        w.id,
        w.name,
        w.status,
        COUNT(t.id) AS scans,
        COUNT(t.id) FILTER (WHERE t.status = 'success') AS transactions,
        COALESCE(SUM(t.discount_amount) FILTER (WHERE t.status = 'success'), 0) AS discount_processed,
        w.last_activity_at
      FROM workers w
      LEFT JOIN transactions t ON t.worker_id = w.id
      WHERE w.deleted_at IS NULL
      GROUP BY w.id, w.name, w.status, w.last_activity_at
      ORDER BY w.name ASC
      LIMIT 100000
    `;
    const res = await client.query(query);
    return res.rows;
  }
}

export const reportsRepository = new ReportsRepository();
