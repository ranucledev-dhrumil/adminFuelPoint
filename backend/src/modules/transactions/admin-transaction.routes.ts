import { Router } from "express";
import { z } from "zod";
import { authMiddleware, requireRole } from "../../common/middleware/auth.js";
import { validateRequest } from "../../common/middleware/validate.js";
import { transactionController } from "./transaction.controller.js";

const router = Router();

// Require admin authentication for all admin transaction endpoints
router.use(authMiddleware, requireRole("admin"));

const idParamSchema = z.object({
  id: z.string().uuid("Invalid transaction ID format"),
});

const adminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort_by: z
    .enum(["submitted_at", "amount", "discount_amount", "status"])
    .optional()
    .default("submitted_at"),
  order: z.enum(["asc", "desc", "ASC", "DESC"]).optional().default("desc"),
  status: z.enum(["pending", "success", "failed"]).optional(),
  customerId: z.string().uuid("Invalid customer ID format").optional(),
  workerId: z.string().uuid("Invalid worker ID format").optional(),
  groupId: z.string().uuid("Invalid group ID format").optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().trim().optional(),
});

const adminUpdateStatusSchema = z.object({
  status: z.enum(["success", "failed"], {
    errorMap: () => ({ message: "Status must be 'success' or 'failed'" }),
  }),
  failureReason: z.string().trim().optional().nullable(),
});

// List transactions with filtering, pagination, and sorting
router.get(
  "/",
  validateRequest({ query: adminListQuerySchema }),
  transactionController.listAdminTransactions,
);

// Get single transaction detail with status change history
router.get(
  "/:id",
  validateRequest({ params: idParamSchema }),
  transactionController.getAdminTransactionDetail,
);

// Admin update transaction status
router.patch(
  "/:id/status",
  validateRequest({ params: idParamSchema, body: adminUpdateStatusSchema }),
  transactionController.updateAdminTransactionStatus,
);

export const adminTransactionRouter = router;
