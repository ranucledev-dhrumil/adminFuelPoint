import { Router } from "express";
import { z } from "zod";
import { validateRequest } from "../../common/middleware/validate.js";
import { authMiddleware, requireRole } from "../../common/middleware/auth.js";
import { customerController } from "./customer.controller.js";

const router = Router();

// Require admin authentication for all customer endpoints
router.use(authMiddleware, requireRole("admin"));

const idParamSchema = z.object({
  id: z.string().uuid("Invalid customer ID format"),
});

const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort_by: z
    .enum([
      "name",
      "registeredAt",
      "lastActivity",
      "transactions",
      "totalSpend",
      "discountReceived",
      "status",
    ])
    .optional()
    .default("registeredAt"),
  order: z.enum(["asc", "desc", "ASC", "DESC"]).optional().default("desc"),
  q: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  group_id: z.string().uuid("Invalid group_id UUID").optional(),
});

const createCustomerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  phone: z.string().trim().min(10, "Phone number must have at least 10 digits"),
  email: z.string().trim().email("Invalid email format").nullable().optional().or(z.literal("")),
  vehicle: z.string().nullable().optional(),
  groupId: z.string().uuid("Invalid groupId UUID").optional(),
});

const updateCustomerSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty").optional(),
  phone: z.string().trim().min(10, "Phone number must have at least 10 digits").optional(),
  email: z.string().trim().email("Invalid email format").nullable().optional().or(z.literal("")),
  vehicle: z.string().nullable().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["active", "inactive"], {
    errorMap: () => ({ message: "Status must be either 'active' or 'inactive'" }),
  }),
});

const assignGroupSchema = z.object({
  groupId: z.string().uuid("Invalid groupId UUID"),
});

router.get(
  "/",
  validateRequest({ query: listCustomersQuerySchema }),
  customerController.listCustomers,
);

router.get(
  "/:id",
  validateRequest({ params: idParamSchema }),
  customerController.getCustomerDetail,
);

router.post(
  "/",
  validateRequest({ body: createCustomerSchema }),
  customerController.createCustomer,
);

router.patch(
  "/:id",
  validateRequest({ params: idParamSchema, body: updateCustomerSchema }),
  customerController.updateCustomer,
);

router.patch(
  "/:id/status",
  validateRequest({ params: idParamSchema, body: updateStatusSchema }),
  customerController.updateStatus,
);

router.patch(
  "/:id/group",
  validateRequest({ params: idParamSchema, body: assignGroupSchema }),
  customerController.assignGroup,
);

router.delete(
  "/:id",
  validateRequest({ params: idParamSchema }),
  customerController.deleteCustomer,
);

export const customerRouter = router;
