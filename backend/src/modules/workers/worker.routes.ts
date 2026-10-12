import { Router } from "express";
import { z } from "zod";
import { validateRequest } from "../../common/middleware/validate.js";
import { authMiddleware, requireRole } from "../../common/middleware/auth.js";
import { workerController } from "./worker.controller.js";

const router = Router();

// Require admin authentication for all worker management endpoints
router.use(authMiddleware, requireRole("admin"));

const idParamSchema = z.object({
  id: z.string().uuid("Invalid worker ID format"),
});

const listWorkersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort_by: z
    .enum([
      "name",
      "joinedAt",
      "lastActivity",
      "scans",
      "transactions",
      "customersScanned",
      "discountProcessed",
      "status",
      "shift",
    ])
    .optional()
    .default("joinedAt"),
  order: z.enum(["asc", "desc", "ASC", "DESC"]).optional().default("desc"),
  q: z.string().optional(),
  status: z.enum(["active", "offline", "suspended"]).optional(),
  shift: z.enum(["Morning", "Evening", "Night"]).optional(),
});

const createWorkerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  phone: z.string().trim().min(10, "Phone number must have at least 10 digits"),
  email: z.string().trim().email("Invalid email format"),
  shift: z.enum(["Morning", "Evening", "Night"], {
    errorMap: () => ({ message: "Shift must be 'Morning', 'Evening', or 'Night'" }),
  }),
  status: z.enum(["active", "offline", "suspended"]).optional().default("active"),
});

const updateWorkerSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty").optional(),
  phone: z.string().trim().min(10, "Phone number must have at least 10 digits").optional(),
  email: z.string().trim().email("Invalid email format").optional(),
  shift: z.enum(["Morning", "Evening", "Night"]).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["active", "offline", "suspended"], {
    errorMap: () => ({ message: "Status must be 'active', 'offline', or 'suspended'" }),
  }),
});

router.get("/", validateRequest({ query: listWorkersQuerySchema }), workerController.listWorkers);

router.get("/:id", validateRequest({ params: idParamSchema }), workerController.getWorkerDetail);

router.post("/", validateRequest({ body: createWorkerSchema }), workerController.createWorker);

router.patch(
  "/:id",
  validateRequest({ params: idParamSchema, body: updateWorkerSchema }),
  workerController.updateWorker,
);

router.patch(
  "/:id/status",
  validateRequest({ params: idParamSchema, body: updateStatusSchema }),
  workerController.updateStatus,
);

router.delete("/:id", validateRequest({ params: idParamSchema }), workerController.deleteWorker);

export const workerRouter = router;
