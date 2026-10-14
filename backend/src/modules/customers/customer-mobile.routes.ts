import { Router } from "express";
import { z } from "zod";
import { validate, validateRequest } from "../../common/middleware/validate.js";
import { authMiddleware, requireRole } from "../../common/middleware/auth.js";
import { customerMobileController } from "./customer-mobile.controller.js";
import { transactionController } from "../transactions/transaction.controller.js";

const router = Router();

const registerSchema = z.object({
  phone: z.string().trim().min(10, "Phone number must have at least 10 digits"),
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  code: z.string().trim().length(6, "OTP code must be 6 digits"),
});

const customerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort_by: z
    .enum(["submitted_at", "amount", "discount_amount", "status"])
    .optional()
    .default("submitted_at"),
  order: z.enum(["asc", "desc", "ASC", "DESC"]).optional().default("desc"),
});

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1, "Name cannot be empty").optional(),
    email: z.string().trim().email("Invalid email format").nullable().optional().or(z.literal("")),
    vehicle: z.string().trim().nullable().optional(),
    phone: z.any().optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.email !== undefined || data.vehicle !== undefined,
    {
      message: "At least one field (name, email, vehicle) is required to update",
    },
  );

router.post("/register", validate(registerSchema), customerMobileController.register);

router.get(
  "/profile",
  authMiddleware,
  requireRole("customer"),
  customerMobileController.getProfile,
);

router.patch(
  "/profile",
  authMiddleware,
  requireRole("customer"),
  validate(updateProfileSchema),
  customerMobileController.updateProfile,
);

router.get("/qr", authMiddleware, requireRole("customer"), customerMobileController.getQr);

router.post(
  "/qr/regenerate",
  authMiddleware,
  requireRole("customer"),
  customerMobileController.regenerateQr,
);

router.get(
  "/transactions",
  authMiddleware,
  requireRole("customer"),
  validateRequest({ query: customerListQuerySchema }),
  transactionController.listCustomerTransactions,
);

export const customerMobileRouter = router;
