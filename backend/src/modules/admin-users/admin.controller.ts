import type { Request, Response, NextFunction } from "express";
import { adminService } from "./admin.service.js";

export class AdminController {
  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminId = req.actor!.sub;
      const profile = await adminService.getProfile(adminId);
      res.status(200).json(profile);
    } catch (err) {
      next(err);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminId = req.actor!.sub;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];

      const profile = await adminService.updateProfile(adminId, req.body, ip, userAgent);
      res.status(200).json({ profile });
    } catch (err) {
      next(err);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminId = req.actor!.sub;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];

      const result = await adminService.changePassword(adminId, req.body, ip, userAgent);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

export const adminController = new AdminController();
