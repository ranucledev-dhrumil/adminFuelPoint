import type { Request, Response, NextFunction } from "express";
import { workerService } from "./worker.service.js";

export class WorkerController {
  listWorkers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await workerService.listWorkers(req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getWorkerDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await workerService.getWorkerDetail(id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  createWorker = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];

      const result = await workerService.createWorker(actor, req.body, ip, userAgent);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  updateWorker = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const { id } = req.params;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];

      const result = await workerService.updateWorker(actor, id, req.body, ip, userAgent);
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

      const result = await workerService.updateStatus(actor, id, req.body.status, ip, userAgent);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  deleteWorker = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const { id } = req.params;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];

      const result = await workerService.deleteWorker(actor, id, ip, userAgent);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

export const workerController = new WorkerController();
