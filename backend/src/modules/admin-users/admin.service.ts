import { pool } from "../../db/pool.js";
import { withTransaction } from "../../db/transaction.js";
import { hashPassword, verifyPassword } from "../../common/utils/crypto.js";
import { normalizeIndianPhone } from "../../common/utils/phone.js";
import { BadRequestError, UnauthorizedError } from "../../common/errors/app-error.js";
import { adminRepository, type AdminUserRow } from "./admin.repository.js";
import { auditService } from "../audit/audit.service.js";
import type { AdminProfileResponse } from "../../common/types/common.js";

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ADM";
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export class AdminService {
  async getProfile(adminId: string): Promise<AdminProfileResponse> {
    const admin = await adminRepository.findById(adminId);
    if (!admin || !admin.is_active) {
      throw new UnauthorizedError("Admin not found or deactivated.", "ADMIN_NOT_FOUND");
    }
    return this.mapAdminProfile(admin);
  }

  async updateProfile(
    adminId: string,
    patch: { name?: string; phone?: string; location?: string },
    ip?: string,
    userAgent?: string,
  ): Promise<AdminProfileResponse> {
    let normalizedPhone: string | null | undefined = undefined;
    if (patch.phone !== undefined) {
      if (patch.phone === "" || patch.phone === null) {
        normalizedPhone = null;
      } else {
        const norm = normalizeIndianPhone(patch.phone);
        if (!norm) {
          throw new BadRequestError("Invalid Indian phone number.", "INVALID_PHONE");
        }
        normalizedPhone = norm;
      }
    }

    let initials: string | undefined = undefined;
    if (patch.name) {
      initials = deriveInitials(patch.name);
    }

    const current = await adminRepository.findById(adminId);
    if (!current || !current.is_active) {
      throw new UnauthorizedError("Admin not found or deactivated.", "ADMIN_NOT_FOUND");
    }

    const updated = await withTransaction(pool, async (client) => {
      const result = await adminRepository.updateProfile(
        adminId,
        {
          name: patch.name,
          phone: normalizedPhone,
          location: patch.location,
          initials,
        },
        client,
      );

      await auditService.recordInTx(
        {
          actorType: "admin",
          actorId: adminId,
          actorName: result.name,
          action: "admin.profile_updated",
          entityType: "admin_user",
          entityId: adminId,
          oldValue: {
            name: current.name,
            phone: current.phone,
            location: current.location,
          },
          newValue: {
            name: result.name,
            phone: result.phone,
            location: result.location,
          },
          ipAddress: ip,
          userAgent,
        },
        client,
      );

      return result;
    });

    return this.mapAdminProfile(updated);
  }

  async changePassword(
    adminId: string,
    params: { currentPassword: string; newPassword: string },
    ip?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const admin = await adminRepository.findById(adminId);
    if (!admin || !admin.is_active) {
      throw new UnauthorizedError("Admin not found or deactivated.", "ADMIN_NOT_FOUND");
    }

    const matches = await verifyPassword(admin.password_hash, params.currentPassword);
    if (!matches) {
      throw new BadRequestError("Current password is incorrect.", "INCORRECT_PASSWORD");
    }

    const newHash = await hashPassword(params.newPassword);

    await withTransaction(pool, async (client) => {
      await adminRepository.updatePassword(adminId, newHash, client);

      await auditService.recordInTx(
        {
          actorType: "admin",
          actorId: adminId,
          actorName: admin.name,
          action: "admin.password_changed",
          entityType: "admin_user",
          entityId: adminId,
          ipAddress: ip,
          userAgent,
        },
        client,
      );
    });

    return { message: "Password changed successfully." };
  }

  private mapAdminProfile(row: AdminUserRow): AdminProfileResponse {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      location: row.location,
      initials: row.initials,
      avatarUrl: row.avatar_url,
      joinedAt: row.joined_at,
      lastLoginAt: row.last_login_at,
    };
  }
}

export const adminService = new AdminService();
