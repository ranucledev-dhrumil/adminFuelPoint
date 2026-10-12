import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";
import { withTransaction } from "../../db/transaction.js";
import {
  hashPassword,
  verifyPassword,
  hashSha256,
  generateOpaqueToken,
  signAccessToken,
} from "../../common/utils/crypto.js";
import {
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
} from "../../common/errors/app-error.js";
import { adminRepository, type AdminUserRow } from "../admin-users/admin.repository.js";
import { authRepository } from "./auth.repository.js";
import { auditService } from "../audit/audit.service.js";
import { emailSender } from "../../integrations/email/index.js";
import { loginProtection } from "./login-protection.js";
import type { AccessTokenClaims, AdminProfileResponse } from "../../common/types/common.js";

export interface AdminLoginResult {
  accessToken: string;
  refreshToken: string;
  admin: AdminProfileResponse;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  async loginAdmin(params: {
    email: string;
    password: string;
    ip: string;
    userAgent?: string;
  }): Promise<AdminLoginResult> {
    const { email, password, ip, userAgent } = params;

    // Check per-IP rate limit
    loginProtection.checkIpAllowed(ip);

    // Apply progressive delay if consecutive failures on this email
    await loginProtection.applyProgressiveDelay(email);

    const admin = await adminRepository.findByEmail(email);

    if (!admin) {
      loginProtection.recordFailure(email, ip);
      await auditService.recordStandalone({
        actorType: "admin",
        actorId: null,
        actorName: null,
        action: "admin.login_failed",
        reason: "INVALID_CREDENTIALS",
        ipAddress: ip,
        userAgent,
      });
      throw new UnauthorizedError("Invalid email or password.", "INVALID_CREDENTIALS");
    }

    if (!admin.is_active) {
      loginProtection.recordFailure(email, ip);
      await auditService.recordStandalone({
        actorType: "admin",
        actorId: admin.id,
        actorName: admin.name,
        action: "admin.login_failed",
        reason: "ADMIN_DEACTIVATED",
        ipAddress: ip,
        userAgent,
      });
      throw new ForbiddenError("Admin account is deactivated.", "ADMIN_DEACTIVATED");
    }

    const passwordMatches = await verifyPassword(admin.password_hash, password);
    if (!passwordMatches) {
      loginProtection.recordFailure(email, ip);
      await auditService.recordStandalone({
        actorType: "admin",
        actorId: admin.id,
        actorName: admin.name,
        action: "admin.login_failed",
        reason: "INVALID_CREDENTIALS",
        ipAddress: ip,
        userAgent,
      });
      throw new UnauthorizedError("Invalid email or password.", "INVALID_CREDENTIALS");
    }

    // Credentials valid -> reset consecutive failures for this email
    loginProtection.recordSuccess(email);

    const rawRefreshToken = generateOpaqueToken(32);
    const tokenHash = hashSha256(rawRefreshToken);
    const expiresAt = new Date(
      Date.now() + env.ADMIN_REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    await withTransaction(pool, async (client) => {
      await adminRepository.updateLastLogin(admin.id, client);
      await authRepository.createRefreshToken(
        {
          tokenHash,
          adminUserId: admin.id,
          expiresAt,
          ipAddress: ip,
          userAgent,
        },
        client,
      );

      await auditService.recordInTx(
        {
          actorType: "admin",
          actorId: admin.id,
          actorName: admin.name,
          action: "admin.login",
          ipAddress: ip,
          userAgent,
        },
        client,
      );
    });

    const accessToken = signAccessToken({
      sub: admin.id,
      role: "admin",
      aud: "fuelpoint-admin",
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      admin: this.mapAdminProfile(admin),
    };
  }

  async refreshToken(rawToken: string, ip?: string, userAgent?: string): Promise<RefreshResult> {
    if (!rawToken) {
      throw new UnauthorizedError("Refresh token required.", "MISSING_REFRESH_TOKEN");
    }

    const tokenHash = hashSha256(rawToken);
    const tokenRow = await authRepository.findRefreshTokenByHash(tokenHash);

    if (!tokenRow) {
      throw new UnauthorizedError("Invalid refresh token.", "INVALID_REFRESH_TOKEN");
    }

    // Reuse detection
    if (tokenRow.revoked_at !== null || tokenRow.replaced_by !== null) {
      await authRepository.revokeAllTokensForActor({
        adminId: tokenRow.admin_user_id,
        customerId: tokenRow.customer_id,
        workerId: tokenRow.worker_id,
      });
      throw new UnauthorizedError(
        "Refresh token reuse detected. All sessions revoked.",
        "REFRESH_TOKEN_REUSED",
      );
    }

    // Expiry check
    if (new Date(tokenRow.expires_at) < new Date()) {
      await authRepository.revokeTokenByHash(tokenHash);
      throw new UnauthorizedError("Refresh token has expired.", "REFRESH_TOKEN_EXPIRED");
    }

    // Admin actor verification
    if (tokenRow.admin_user_id) {
      const admin = await adminRepository.findById(tokenRow.admin_user_id);
      if (!admin || !admin.is_active) {
        await authRepository.revokeAllTokensForAdmin(tokenRow.admin_user_id);
        throw new ForbiddenError("Admin account is deactivated.", "ADMIN_DEACTIVATED");
      }

      const newRawRefreshToken = generateOpaqueToken(32);
      const newTokenHash = hashSha256(newRawRefreshToken);
      const expiresAt = new Date(
        Date.now() + env.ADMIN_REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      );

      await withTransaction(pool, async (client) => {
        const newId = await authRepository.createRefreshToken(
          {
            tokenHash: newTokenHash,
            adminUserId: admin.id,
            expiresAt,
            ipAddress: ip,
            userAgent,
          },
          client,
        );
        await authRepository.rotateRefreshToken(tokenRow.id, newId, client);
      });

      const accessToken = signAccessToken({
        sub: admin.id,
        role: "admin",
        aud: "fuelpoint-admin",
      });

      return {
        accessToken,
        refreshToken: newRawRefreshToken,
      };
    }

    throw new UnauthorizedError("Unsupported actor type for refresh token.", "UNAUTHORIZED");
  }

  async logout(params: {
    actor?: AccessTokenClaims;
    rawToken?: string;
    allDevices?: boolean;
    ip?: string;
    userAgent?: string;
  }): Promise<{ message: string }> {
    const { actor, rawToken, allDevices, ip, userAgent } = params;

    if (allDevices) {
      if (!actor) {
        throw new UnauthorizedError(
          "Authentication required to log out all devices.",
          "UNAUTHORIZED",
        );
      }

      if (actor.role === "admin") {
        await authRepository.revokeAllTokensForAdmin(actor.sub);
        await auditService.recordStandalone({
          actorType: "admin",
          actorId: actor.sub,
          action: "admin.logout",
          newValue: { allDevices: true },
          ipAddress: ip,
          userAgent,
        });
      }
    } else {
      if (rawToken) {
        const tokenHash = hashSha256(rawToken);
        await authRepository.revokeTokenByHash(tokenHash);
      }
      if (actor && actor.role === "admin") {
        await auditService.recordStandalone({
          actorType: "admin",
          actorId: actor.sub,
          action: "admin.logout",
          newValue: { allDevices: false },
          ipAddress: ip,
          userAgent,
        });
      }
    }

    return { message: "Logged out successfully" };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const cleanEmail = email.toLowerCase().trim();
    const admin = await adminRepository.findByEmail(cleanEmail);

    if (admin && admin.is_active) {
      const rawToken = generateOpaqueToken(32);
      const tokenHash = hashSha256(rawToken);
      const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

      await withTransaction(pool, async (client) => {
        await authRepository.invalidateExistingResetTokens(admin.id, client);
        await authRepository.createPasswordResetToken(
          {
            adminUserId: admin.id,
            tokenHash,
            expiresAt,
          },
          client,
        );
      });

      await emailSender.sendPasswordResetEmail(cleanEmail, admin.name, rawToken);
    } else {
      // Timing safety: perform a dummy hash to keep response time indistinguishable
      hashSha256(cleanEmail + Date.now());
    }

    return { message: "If the email is registered, a password reset link has been sent." };
  }

  async resetPassword(params: {
    token: string;
    newPassword: string;
    ip?: string;
    userAgent?: string;
  }): Promise<{ message: string }> {
    const { token, newPassword, ip, userAgent } = params;
    const tokenHash = hashSha256(token);

    const resetRow = await authRepository.findValidResetToken(tokenHash);
    if (!resetRow) {
      throw new BadRequestError(
        "Reset token is invalid or has expired.",
        "INVALID_OR_EXPIRED_RESET_TOKEN",
      );
    }

    const admin = await adminRepository.findById(resetRow.admin_user_id);
    if (!admin || !admin.is_active) {
      throw new BadRequestError(
        "Reset token is invalid or has expired.",
        "INVALID_OR_EXPIRED_RESET_TOKEN",
      );
    }

    const newPasswordHash = await hashPassword(newPassword);

    await withTransaction(pool, async (client) => {
      await authRepository.markResetTokenUsed(resetRow.id, client);
      await adminRepository.updatePassword(admin.id, newPasswordHash, client);
      await authRepository.revokeAllTokensForAdmin(admin.id, client);

      await auditService.recordInTx(
        {
          actorType: "admin",
          actorId: admin.id,
          actorName: admin.name,
          action: "admin.password_changed",
          entityType: "admin_user",
          entityId: admin.id,
          ipAddress: ip,
          userAgent,
        },
        client,
      );
    });

    return { message: "Password successfully reset. You may now log in." };
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

export const authService = new AuthService();
