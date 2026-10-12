import type { Request, Response, NextFunction } from "express";
import { customerService } from "./customer.service.js";

export class CustomerController {
  listCustomers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await customerService.listCustomers(req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getCustomerDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await customerService.getCustomerDetail(id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  createCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];

      const result = await customerService.createCustomer(actor, req.body, ip, userAgent);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  updateCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const { id } = req.params;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];

      const result = await customerService.updateCustomer(actor, id, req.body, ip, userAgent);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const { id } = req.params;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];

      const result = await customerService.updateStatus(actor, id, req.body.status, ip, userAgent);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  assignGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const { id } = req.params;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];

      const result = await customerService.assignGroup(actor, id, req.body.groupId, ip, userAgent);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  deleteCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const { id } = req.params;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];

      const result = await customerService.deleteCustomer(actor, id, ip, userAgent);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

export const customerController = new CustomerController();
