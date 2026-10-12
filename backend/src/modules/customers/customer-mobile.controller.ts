import type { Request, Response, NextFunction } from "express";
import { customerMobileService } from "./customer-mobile.service.js";

export class CustomerMobileController {
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];
      const result = await customerMobileService.register(req.body, ip, userAgent);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  getQr = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const result = await customerMobileService.getQr(actor);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  regenerateQr = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];
      const result = await customerMobileService.regenerateQr(actor, ip, userAgent);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

export const customerMobileController = new CustomerMobileController();
