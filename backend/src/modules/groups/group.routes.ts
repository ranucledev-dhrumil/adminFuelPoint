import { Router } from "express";
import { z } from "zod";
import { validateRequest } from "../../common/middleware/validate.js";
import { authMiddleware, requireRole } from "../../common/middleware/auth.js";
import { groupController } from "./group.controller.js";

const router = Router();

// Protect all group routes for admin
router.use(authMiddleware, requireRole("admin"));

const idParamSchema = z.object({
  id: z.string().uuid("Invalid group ID format"),
});

const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required"),
  discountPercent: z.coerce
    .number({ invalid_type_error: "Discount percent must be a number" })
    .min(0, "Discount percent must be at least 0")
    .max(100, "Discount percent cannot exceed 100"),
  description: z.string().nullable().optional(),
  active: z.boolean().optional().default(true),
});

const editGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name cannot be empty").optional(),
  discountPercent: z.coerce
    .number({ invalid_type_error: "Discount percent must be a number" })
    .min(0, "Discount percent must be at least 0")
    .max(100, "Discount percent cannot exceed 100")
    .optional(),
  description: z.string().nullable().optional(),
});

router.get("/", groupController.listGroups);

router.post("/", validateRequest({ body: createGroupSchema }), groupController.createGroup);

router.patch(
  "/:id",
  validateRequest({ params: idParamSchema, body: editGroupSchema }),
  groupController.editGroup,
);

router.patch(
  "/:id/toggle-active",
  validateRequest({ params: idParamSchema }),
  groupController.toggleActive,
);

router.delete("/:id", validateRequest({ params: idParamSchema }), groupController.deleteGroup);

export const groupRouter = router;
