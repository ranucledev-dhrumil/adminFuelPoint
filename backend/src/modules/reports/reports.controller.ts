import type { Request, Response, NextFunction } from "express";
import { reportsService, type ReportCategory } from "./reports.service.js";

export class ReportsController {
  getOverview = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await reportsService.getDashboardOverview();
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getSeries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const days = req.query.days ? Number(req.query.days) : 7;
      const result = await reportsService.getDashboardSeries(days);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getWorkerActivity = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await reportsService.getWorkerActivity();
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getGroupDistribution = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await reportsService.getGroupDistribution();
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const category = req.query.category as ReportCategory;
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;

      const result = await reportsService.getReportsSummary(category, from, to);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  exportReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const category = req.query.category as ReportCategory;
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;

      await reportsService.exportCsvReport(category, from, to, res);
    } catch (err) {
      next(err);
    }
  };

  globalSearch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = (req.query.q as string) || "";
      const result = await reportsService.globalSearch(q);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

export const reportsController = new ReportsController();
