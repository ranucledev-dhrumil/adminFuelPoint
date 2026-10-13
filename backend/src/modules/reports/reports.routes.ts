import { Router } from "express";
import { z } from "zod";
import { authMiddleware, requireRole } from "../../common/middleware/auth.js";
import { validateRequest } from "../../common/middleware/validate.js";
import { reportsController } from "./reports.controller.js";

// ==========================================
// Dashboard Router (/api/v1/admin/dashboard)
// ==========================================
const dashboard = Router();
dashboard.use(authMiddleware, requireRole("admin"));

const seriesQuerySchema = z.object({
  days: z.coerce.number().int().optional().default(7),
});

dashboard.get("/overview", reportsController.getOverview);
dashboard.get(
  "/series",
  validateRequest({ query: seriesQuerySchema }),
  reportsController.getSeries,
);
dashboard.get("/worker-activity", reportsController.getWorkerActivity);
dashboard.get("/group-distribution", reportsController.getGroupDistribution);

export const dashboardRouter = dashboard;

// ==========================================
// Reports Router (/api/v1/admin/reports)
// ==========================================
const reports = Router();
reports.use(authMiddleware, requireRole("admin"));

const summaryQuerySchema = z.object({
  category: z.enum(["transactions", "discount", "customers", "workers", "groups"], {
    errorMap: () => ({ message: "Invalid category" }),
  }),
  from: z.string().optional(),
  to: z.string().optional(),
});

const exportQuerySchema = z.object({
  category: z.enum(["transactions", "discount", "customers", "workers", "groups"], {
    errorMap: () => ({ message: "Invalid category" }),
  }),
  from: z.string().optional(),
  to: z.string().optional(),
  format: z.enum(["csv", "json"]).optional().default("csv"),
});

reports.get(
  "/summary",
  validateRequest({ query: summaryQuerySchema }),
  reportsController.getSummary,
);
reports.get(
  "/export",
  validateRequest({ query: exportQuerySchema }),
  reportsController.exportReport,
);

export const reportsRouter = reports;

// ==========================================
// Global Search Schema
// ==========================================
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, "Search query must be at least 1 character"),
});
