import type pg from "pg";
import { pool } from "../../db/pool.js";

export type NotificationType = "registration" | "worker";

export interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  customer_id: string | null;
  worker_id: string | null;
  is_read: boolean;
  read_at: Date | null;
  created_at: Date;
  total_count?: string | number;
}

export interface CreateNotificationParams {
  type: NotificationType;
  title: string;
  message: string;
  customerId?: string | null;
  workerId?: string | null;
}

export interface FindNotificationsParams {
  page: number;
  limit: number;
  type?: NotificationType;
  unreadOnly?: boolean;
}

export class NotificationRepository {
  async create(
    params: CreateNotificationParams,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<NotificationRow> {
    const query = `
      INSERT INTO notifications (type, title, message, customer_id, worker_id, is_read)
      VALUES ($1, $2, $3, $4, $5, FALSE)
      RETURNING *;
    `;
    const res = await client.query<NotificationRow>(query, [
      params.type,
      params.title,
      params.message,
      params.customerId || null,
      params.workerId || null,
    ]);
    return res.rows[0];
  }

  async findNotifications(
    params: FindNotificationsParams,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<{ rows: NotificationRow[]; total: number }> {
    const conditions: string[] = ["1=1"];
    const values: unknown[] = [];
    let idx = 1;

    if (params.type) {
      conditions.push(`type = $${idx++}`);
      values.push(params.type);
    }
    if (params.unreadOnly) {
      conditions.push(`is_read = FALSE`);
    }

    const offset = (params.page - 1) * params.limit;
    values.push(params.limit);
    const limitIdx = idx++;
    values.push(offset);
    const offsetIdx = idx++;

    const query = `
      SELECT 
        id, type, title, message, customer_id, worker_id, is_read, read_at, created_at,
        COUNT(*) OVER() AS total_count
      FROM notifications
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const res = await client.query(query, values);
    const total = res.rows.length > 0 ? Number(res.rows[0].total_count) : 0;
    return { rows: res.rows, total };
  }

  async countUnread(client: pg.Pool | pg.PoolClient = pool): Promise<number> {
    const query = `SELECT COUNT(*) AS unread_count FROM notifications WHERE is_read = FALSE;`;
    const res = await client.query(query);
    return Number(res.rows[0]?.unread_count || 0);
  }

  async markAsRead(
    id: string,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<NotificationRow | null> {
    const query = `
      UPDATE notifications
      SET is_read = TRUE, read_at = now()
      WHERE id = $1
      RETURNING *;
    `;
    const res = await client.query<NotificationRow>(query, [id]);
    return res.rows[0] || null;
  }

  async markAllAsRead(client: pg.Pool | pg.PoolClient = pool): Promise<number> {
    const query = `
      UPDATE notifications
      SET is_read = TRUE, read_at = now()
      WHERE is_read = FALSE;
    `;
    const res = await client.query(query);
    return res.rowCount || 0;
  }
}

export const notificationRepository = new NotificationRepository();
