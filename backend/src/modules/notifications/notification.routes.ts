import { Router } from "express";
import { z } from "zod";
import { authMiddleware, requireRole } from "../../common/middleware/auth.js";
import { validateRequest } from "../../common/middleware/validate.js";
import { notificationController } from "./notification.controller.js";

const router = Router();

// Require admin authentication
router.use(authMiddleware, requireRole("admin"));

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  type: z.enum(["registration", "worker"]).optional(),
  unreadOnly: z.union([z.boolean(), z.string()]).optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid("Invalid notification ID format"),
});

router.get(
  "/",
  validateRequest({ query: listQuerySchema }),
  notificationController.listNotifications,
);

router.patch(
  "/:id/read",
  validateRequest({ params: idParamSchema }),
  notificationController.markAsRead,
);

router.post("/mark-all-read", notificationController.markAllAsRead);

export const notificationRouter = router;
