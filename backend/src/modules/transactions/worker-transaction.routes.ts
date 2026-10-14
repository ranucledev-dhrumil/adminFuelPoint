import { Router } from "express";
import { z } from "zod";
import { authMiddleware, requireRole } from "../../common/middleware/auth.js";
import { workerScanRateLimiter } from "../../common/middleware/rate-limiter.js";
import { validateRequest } from "../../common/middleware/validate.js";
import { transactionController } from "./transaction.controller.js";
import { workerController } from "../workers/worker.controller.js";

const router = Router();

// Require worker authentication for all worker endpoints
router.use(authMiddleware, requireRole("worker"));

// Worker mobile profile endpoint (read-only)
router.get("/profile", workerController.getProfile);

const scanSchema = z.object({
  qrToken: z.string().trim().min(1, "QR token is required"),
});

const createTransactionSchema = z.object({
  id: z.string().uuid("Invalid client transaction ID format"),
  scanTicket: z.string().trim().min(1, "Scan ticket is required"),
  amount: z.union([z.string(), z.number()]).transform((v) => String(v).trim()),
  litres: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .optional()
    .nullable(),
  fuelType: z.enum(["Petrol", "Diesel", "CNG"]).optional().nullable(),
});

const idParamSchema = z.object({
  id: z.string().uuid("Invalid transaction ID format"),
});

const updateStatusSchema = z.object({
  status: z.enum(["success", "failed"], {
    errorMap: () => ({ message: "Status must be 'success' or 'failed'" }),
  }),
  failureReason: z.string().trim().optional().nullable(),
});

const workerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(["pending", "success", "failed"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sort_by: z
    .enum(["submitted_at", "amount", "discount_amount", "status"])
    .optional()
    .default("submitted_at"),
  order: z.enum(["asc", "desc", "ASC", "DESC"]).optional().default("desc"),
});

// Scan customer QR code
router.post(
  "/scan",
  workerScanRateLimiter,
  validateRequest({ body: scanSchema }),
  transactionController.scan,
);

// Submit transaction
router.post(
  "/transactions",
  validateRequest({ body: createTransactionSchema }),
  transactionController.createTransaction,
);

// Update status of worker's own transaction
router.patch(
  "/transactions/:id/status",
  validateRequest({ params: idParamSchema, body: updateStatusSchema }),
  transactionController.updateWorkerTransactionStatus,
);

// List worker's own transactions
router.get(
  "/transactions",
  validateRequest({ query: workerListQuerySchema }),
  transactionController.listWorkerTransactions,
);

export const workerTransactionRouter = router;
