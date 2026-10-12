import { Router } from "express";
import { z } from "zod";
import { validate } from "../../common/middleware/validate.js";
import { authMiddleware, requireRole } from "../../common/middleware/auth.js";
import { customerMobileController } from "./customer-mobile.controller.js";

const router = Router();

const registerSchema = z.object({
  phone: z.string().trim().min(10, "Phone number must have at least 10 digits"),
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  code: z.string().trim().length(6, "OTP code must be 6 digits"),
});

router.post("/register", validate(registerSchema), customerMobileController.register);

router.get("/qr", authMiddleware, requireRole("customer"), customerMobileController.getQr);

router.post(
  "/qr/regenerate",
  authMiddleware,
  requireRole("customer"),
  customerMobileController.regenerateQr,
);

export const customerMobileRouter = router;
