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
}

export interface CreateNotificationParams {
  type: NotificationType;
  title: string;
  message: string;
  customerId?: string | null;
  workerId?: string | null;
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
}

export const notificationRepository = new NotificationRepository();
