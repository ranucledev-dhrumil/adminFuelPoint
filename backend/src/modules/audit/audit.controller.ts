import type { Request, Response, NextFunction } from "express";
import { auditService } from "./audit.service.js";

export class AuditController {
  listAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await auditService.listAuditLogs(req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

export const auditController = new AuditController();
