import { Router } from "express";
import { z } from "zod";
import { authMiddleware, requireRole } from "../../common/middleware/auth.js";
import { validateRequest } from "../../common/middleware/validate.js";
import { auditController } from "./audit.controller.js";

const router = Router();

// Require admin authentication
router.use(authMiddleware, requireRole("admin"));

const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  action: z.string().optional(),
  actorType: z.enum(["admin", "worker", "customer", "system"]).optional(),
  actorId: z.string().uuid().optional(),
  entityType: z.enum(["customer", "worker", "group", "transaction", "admin_user"]).optional(),
  entityId: z.string().uuid().optional(),
  reason: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

router.get(
  "/",
  validateRequest({ query: listAuditLogsQuerySchema }),
  auditController.listAuditLogs,
);

export const auditRouter = router;
