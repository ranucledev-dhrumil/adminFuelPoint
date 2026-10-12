import type pg from "pg";
import { pool } from "../../db/pool.js";
import {
  notificationRepository,
  type CreateNotificationParams,
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
}

export const notificationService = new NotificationService();
