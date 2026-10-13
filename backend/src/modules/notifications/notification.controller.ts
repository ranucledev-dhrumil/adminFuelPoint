import type { Request, Response, NextFunction } from "express";
import { notificationService } from "./notification.service.js";

export class NotificationController {
  listNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await notificationService.listNotifications(req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await notificationService.markAsRead(id);
      res.status(200).json({ notification: result });
    } catch (err) {
      next(err);
    }
  };

  markAllAsRead = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await notificationService.markAllAsRead();
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

export const notificationController = new NotificationController();
