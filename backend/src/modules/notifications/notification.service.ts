import type pg from "pg";
import { pool } from "../../db/pool.js";
import { NotFoundError } from "../../common/errors/app-error.js";
import {
  notificationRepository,
  type CreateNotificationParams,
  type NotificationType,
} from "./notification.repository.js";

export class NotificationService {
  async notify(params: CreateNotificationParams, client: pg.Pool | pg.PoolClient = pool) {
    return notificationRepository.create(params, client);
  }

  async notifyWorkerFirstLogin(workerId: string, workerName: string, client?: pg.PoolClient) {
    return notificationRepository.create(
      {
        type: "worker",
        title: "Worker First Login",
        message: `Worker ${workerName} has logged in for the first time.`,
        workerId,
      },
      client,
    );
  }

  async notifyCustomerRegistered(customerId: string, customerName: string, client?: pg.PoolClient) {
    return notificationRepository.create(
      {
        type: "registration",
        title: "New Customer Registered",
        message: `Customer ${customerName} registered via mobile app.`,
        customerId,
      },
      client,
    );
  }

  async listNotifications(query: {
    page?: number;
    limit?: number;
    type?: NotificationType;
    unreadOnly?: boolean | string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const unreadOnly =
      query.unreadOnly === true || query.unreadOnly === "true" || query.unreadOnly === "1";

    const [{ rows, total }, unreadCount] = await Promise.all([
      notificationRepository.findNotifications({
        page,
        limit,
        type: query.type,
        unreadOnly,
      }),
      notificationRepository.countUnread(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      notifications: rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        message: r.message,
        isRead: r.is_read,
        readAt: r.read_at ? r.read_at.toISOString() : null,
        customerId: r.customer_id,
        workerId: r.worker_id,
        createdAt: r.created_at.toISOString(),
      })),
      unreadCount,
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

  async markAsRead(id: string) {
    const notif = await notificationRepository.markAsRead(id);
    if (!notif) {
      throw new NotFoundError("Notification not found", "NOTIFICATION_NOT_FOUND");
    }
    return {
      id: notif.id,
      isRead: notif.is_read,
      readAt: notif.read_at ? notif.read_at.toISOString() : null,
    };
  }

  async markAllAsRead() {
    await notificationRepository.markAllAsRead();
    return {
      message: "All notifications marked as read",
    };
  }
}

export const notificationService = new NotificationService();
