import { Router } from "express";
import { z } from "zod";
import { validate } from "../../common/middleware/validate.js";
import { authMiddleware, requireRole } from "../../common/middleware/auth.js";
import { adminController } from "./admin.controller.js";
import { groupRouter } from "../groups/group.routes.js";
import { customerRouter } from "../customers/customer.routes.js";
import { workerRouter } from "../workers/worker.routes.js";

const router = Router();

const updateProfileSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").optional(),
  phone: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters long"),
});

router.use(authMiddleware, requireRole("admin"));

router.get("/profile", adminController.getProfile);
router.patch("/profile", validate(updateProfileSchema), adminController.updateProfile);
router.post(
  "/profile/change-password",
  validate(changePasswordSchema),
  adminController.changePassword,
);

router.use("/groups", groupRouter);
router.use("/customers", customerRouter);
router.use("/workers", workerRouter);

export const adminRouter = router;
