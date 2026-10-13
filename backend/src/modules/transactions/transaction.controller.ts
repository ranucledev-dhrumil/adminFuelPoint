import type { Request, Response, NextFunction } from "express";
import { transactionService } from "./transaction.service.js";

export class TransactionController {
  scan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];

      const result = await transactionService.scanQr(actor, req.body.qrToken, ip, userAgent);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  createTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];

      const { transaction, isRetry } = await transactionService.createTransaction(
        actor,
        req.body,
        ip,
        userAgent,
      );

      // Return 200 OK on idempotent retry, 201 Created on fresh insert
      res.status(isRetry ? 200 : 201).json(transaction);
    } catch (err) {
      next(err);
    }
  };

  updateWorkerTransactionStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actor = req.actor!;
      const { id } = req.params;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];

      const tx = await transactionService.updateStatus(actor, id, req.body, ip, userAgent);

      res.status(200).json({
        id: tx.id,
        status: tx.status,
        resolvedAt: tx.resolvedAt,
        updatedAt: tx.updatedAt,
      });
    } catch (err) {
      next(err);
    }
  };

  listWorkerTransactions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actor = req.actor!;
      const result = await transactionService.listWorkerTransactions(actor.sub, req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  listCustomerTransactions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actor = req.actor!;
      const result = await transactionService.listCustomerTransactions(actor.sub, req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  listAdminTransactions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await transactionService.listAdminTransactions(req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getAdminTransactionDetail = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await transactionService.getAdminTransactionDetail(id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  updateAdminTransactionStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actor = req.actor!;
      const { id } = req.params;
      const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"];

      const tx = await transactionService.updateStatus(actor, id, req.body, ip, userAgent);

      res.status(200).json({
        transaction: tx,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const transactionController = new TransactionController();
