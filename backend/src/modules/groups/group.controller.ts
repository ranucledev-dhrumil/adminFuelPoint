import type { Request, Response, NextFunction } from "express";
import { groupService } from "./group.service.js";

export class GroupController {
  listGroups = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const groups = await groupService.listGroups();
      res.status(200).json({ groups });
    } catch (err) {
      next(err);
    }
  };

  createGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];

      const group = await groupService.createGroup(actor, req.body, ip, userAgent);
      res.status(201).json({ group });
    } catch (err) {
      next(err);
    }
  };

  editGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const { id } = req.params;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];

      const group = await groupService.editGroup(actor, id, req.body, ip, userAgent);
      res.status(200).json({ group });
    } catch (err) {
      next(err);
    }
  };

  toggleActive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const { id } = req.params;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];

      const group = await groupService.toggleActive(actor, id, ip, userAgent);
      res.status(200).json({ group });
    } catch (err) {
      next(err);
    }
  };

  deleteGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const { id } = req.params;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];

      const result = await groupService.deleteGroup(actor, id, ip, userAgent);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

export const groupController = new GroupController();
