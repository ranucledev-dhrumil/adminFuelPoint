import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { validate } from "../../common/middleware/validate.js";
import { authMiddleware } from "../../common/middleware/auth.js";
import { authController } from "./auth.controller.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

const requestOtpSchema = z.object({
  destination: z.string().trim().min(10, "Destination must be at least 10 digits"),
  purpose: z.enum(["login", "register"]),
  channel: z.enum(["sms", "email"]).optional().default("sms"),
  actor_type: z.enum(["customer", "worker"]).optional(),
});

const verifyOtpSchema = z.object({
  destination: z.string().trim().min(10, "Destination must be at least 10 digits"),
  code: z.string().trim().length(6, "OTP code must be 6 digits"),
  actor_type: z.enum(["customer", "worker"]),
});

function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    authMiddleware(req, res, next);
  } else {
    next();
  }
}

router.post("/otp/request", validate(requestOtpSchema), authController.requestOtp);
router.post("/otp/verify", validate(verifyOtpSchema), authController.verifyOtp);
router.post("/admin/login", validate(loginSchema), authController.loginAdmin);
router.post("/refresh", authController.refreshToken);
router.post("/logout", optionalAuth, authController.logout);
router.post(
  "/admin/forgot-password",
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);
router.post("/admin/reset-password", validate(resetPasswordSchema), authController.resetPassword);

export const authRouter = router;
