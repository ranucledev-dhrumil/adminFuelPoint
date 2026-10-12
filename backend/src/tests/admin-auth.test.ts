import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { testPool, ensureTestDatabaseMigrated, truncateAllTables } from "./test-db.js";
import { hashPassword, hashSha256 } from "../common/utils/crypto.js";
import { loginProtection } from "../modules/auth/login-protection.js";

describe("Admin Authentication & Password Flows Integration Tests", () => {
  const TEST_PASSWORD = "CorrectPassword123!";
  let adminId: string;
  let adminEmail: string;

  beforeAll(async () => {
    await ensureTestDatabaseMigrated();
  });

  beforeEach(async () => {
    await truncateAllTables();
    loginProtection.reset();

    // Create a test admin
    adminEmail = "admin@test.local";
    const passwordHash = await hashPassword(TEST_PASSWORD);
    const res = await testPool.query(
      `INSERT INTO admin_users (name, email, password_hash, role, initials, is_active)
       VALUES ('Test Admin', $1, $2, 'Super Admin', 'TA', TRUE)
       RETURNING id, email`,
      [adminEmail, passwordHash],
    );
    adminId = res.rows[0].id;
  });

  afterAll(async () => {
    await testPool.end();
  });

  // ============================================================================
  // 1. POST /api/v1/auth/admin/login
  // ============================================================================
  describe("POST /api/v1/auth/admin/login", () => {
    it("successfully logs in with valid credentials, returns tokens and sets cookie", async () => {
      const res = await request(app)
        .post("/api/v1/auth/admin/login")
        .send({ email: adminEmail, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.body.admin).toMatchObject({
        id: adminId,
        email: adminEmail,
        name: "Test Admin",
        role: "Super Admin",
        initials: "TA",
      });

      // Verify Set-Cookie header
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies.join("; ") : cookies;
      expect(cookieStr).toContain("fuelpoint_refresh_token=");
      expect(cookieStr.toLowerCase()).toContain("httponly");
      expect(cookieStr.toLowerCase()).toContain("samesite=strict");

      // Verify refresh_tokens row created in DB
      const tokens = await testPool.query("SELECT * FROM refresh_tokens WHERE admin_user_id = $1", [
        adminId,
      ]);
      expect(tokens.rowCount).toBe(1);
      expect(tokens.rows[0].revoked_at).toBeNull();

      // Verify audit_logs record created
      const audit = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'admin.login' AND actor_id = $1",
        [adminId],
      );
      expect(audit.rowCount).toBe(1);
      expect(audit.rows[0].actor_type).toBe("admin");

      // Verify last_login_at updated
      const adminRow = await testPool.query("SELECT last_login_at FROM admin_users WHERE id = $1", [
        adminId,
      ]);
      expect(adminRow.rows[0].last_login_at).not.toBeNull();
    });

    it("rejects incorrect password with 401 and logs admin.login_failed in standalone audit", async () => {
      const res = await request(app)
        .post("/api/v1/auth/admin/login")
        .send({ email: adminEmail, password: "WrongPassword123" });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");

      // Verify failed login audit log exists
      const audit = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'admin.login_failed' AND actor_id = $1",
        [adminId],
      );
      expect(audit.rowCount).toBe(1);
      expect(audit.rows[0].reason).toBe("INVALID_CREDENTIALS");
    });

    it("rejects unknown email with 401 and logs admin.login_failed with NULL actor_id", async () => {
      const res = await request(app)
        .post("/api/v1/auth/admin/login")
        .send({ email: "unknown@test.local", password: "SomePassword123" });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");

      const audit = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'admin.login_failed' AND actor_id IS NULL",
      );
      expect(audit.rowCount).toBe(1);
    });

    it("rejects deactivated admin with 403 and logs admin.login_failed", async () => {
      await testPool.query("UPDATE admin_users SET is_active = FALSE WHERE id = $1", [adminId]);

      const res = await request(app)
        .post("/api/v1/auth/admin/login")
        .send({ email: adminEmail, password: TEST_PASSWORD });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ADMIN_DEACTIVATED");

      const audit = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'admin.login_failed' AND reason = 'ADMIN_DEACTIVATED'",
      );
      expect(audit.rowCount).toBe(1);
    });

    it("rejects malformed email with 422 validation error", async () => {
      const res = await request(app)
        .post("/api/v1/auth/admin/login")
        .send({ email: "not-an-email", password: TEST_PASSWORD });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // ============================================================================
  // 2. POST /api/v1/auth/refresh
  // ============================================================================
  describe("POST /api/v1/auth/refresh", () => {
    it("successfully refreshes token from cookie and rotates refresh token", async () => {
      // Login first
      const loginRes = await request(app)
        .post("/api/v1/auth/admin/login")
        .send({ email: adminEmail, password: TEST_PASSWORD });

      const cookie = loginRes.headers["set-cookie"];

      // Refresh using cookie
      const refreshRes = await request(app).post("/api/v1/auth/refresh").set("Cookie", cookie);

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body).toHaveProperty("accessToken");
      expect(refreshRes.body).toHaveProperty("refreshToken");

      // Verify old token was rotated in database
      const oldTokens = await testPool.query(
        "SELECT * FROM refresh_tokens WHERE admin_user_id = $1 ORDER BY created_at ASC",
        [adminId],
      );
      expect(oldTokens.rowCount).toBe(2);
      expect(oldTokens.rows[0].revoked_at).not.toBeNull();
      expect(oldTokens.rows[0].replaced_by).toBe(oldTokens.rows[1].id);
      expect(oldTokens.rows[1].revoked_at).toBeNull();
    });

    it("triggers reuse detection and revokes all sessions when a replaced token is reused", async () => {
      const loginRes = await request(app)
        .post("/api/v1/auth/admin/login")
        .send({ email: adminEmail, password: TEST_PASSWORD });

      const cookie1 = loginRes.headers["set-cookie"];

      // Refresh once -> rotates token
      const refreshRes = await request(app).post("/api/v1/auth/refresh").set("Cookie", cookie1);
      expect(refreshRes.status).toBe(200);

      // Malicious attempt: present cookie1 again (re-use of rotated token)
      const reuseRes = await request(app).post("/api/v1/auth/refresh").set("Cookie", cookie1);

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.error.code).toBe("REFRESH_TOKEN_REUSED");

      // All refresh tokens for this admin must now be revoked!
      const activeTokens = await testPool.query(
        "SELECT * FROM refresh_tokens WHERE admin_user_id = $1 AND revoked_at IS NULL",
        [adminId],
      );
      expect(activeTokens.rowCount).toBe(0);
    });

    it("rejects expired refresh token with 401", async () => {
      // Insert an expired token
      const expiredHash = hashSha256("expired_raw_token");
      await testPool.query(
        `INSERT INTO refresh_tokens (token_hash, admin_user_id, expires_at)
         VALUES ($1, $2, now() - interval '1 hour')`,
        [expiredHash, adminId],
      );

      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: "expired_raw_token" });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("REFRESH_TOKEN_EXPIRED");
    });

    it("rejects refresh when admin is deactivated", async () => {
      const loginRes = await request(app)
        .post("/api/v1/auth/admin/login")
        .send({ email: adminEmail, password: TEST_PASSWORD });

      const cookie = loginRes.headers["set-cookie"];

      // Deactivate admin
      await testPool.query("UPDATE admin_users SET is_active = FALSE WHERE id = $1", [adminId]);

      const res = await request(app).post("/api/v1/auth/refresh").set("Cookie", cookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ADMIN_DEACTIVATED");
    });
  });

  // ============================================================================
  // 3. POST /api/v1/auth/logout
  // ============================================================================
  describe("POST /api/v1/auth/logout", () => {
    it("single-device logout revokes current token and clears cookie", async () => {
      const loginRes = await request(app)
        .post("/api/v1/auth/admin/login")
        .send({ email: adminEmail, password: TEST_PASSWORD });

      const cookie = loginRes.headers["set-cookie"];
      const accessToken = loginRes.body.accessToken;

      const logoutRes = await request(app)
        .post("/api/v1/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Cookie", cookie)
        .send({ allDevices: false });

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.message).toBe("Logged out successfully");

      // Verify token revoked in DB
      const tokens = await testPool.query(
        "SELECT * FROM refresh_tokens WHERE admin_user_id = $1 AND revoked_at IS NOT NULL",
        [adminId],
      );
      expect(tokens.rowCount).toBe(1);

      // Verify audit logged
      const audit = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'admin.logout' AND actor_id = $1",
        [adminId],
      );
      expect(audit.rowCount).toBe(1);
    });

    it("all-devices logout revokes all refresh tokens for that admin", async () => {
      // Create two sessions
      const _s1 = await request(app)
        .post("/api/v1/auth/admin/login")
        .send({ email: adminEmail, password: TEST_PASSWORD });

      const s2 = await request(app)
        .post("/api/v1/auth/admin/login")
        .send({ email: adminEmail, password: TEST_PASSWORD });

      const accessToken = s2.body.accessToken;

      const logoutRes = await request(app)
        .post("/api/v1/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ allDevices: true });

      expect(logoutRes.status).toBe(200);

      // All active tokens must be revoked
      const active = await testPool.query(
        "SELECT * FROM refresh_tokens WHERE admin_user_id = $1 AND revoked_at IS NULL",
        [adminId],
      );
      expect(active.rowCount).toBe(0);
    });
  });

  // ============================================================================
  // 4. Forgot Password & Reset Password Flows
  // ============================================================================
  describe("Forgot & Reset Password", () => {
    it("forgot-password sends email and creates reset token; returns identical message for unknown email", async () => {
      // Registered admin
      const res1 = await request(app)
        .post("/api/v1/auth/admin/forgot-password")
        .send({ email: adminEmail });

      expect(res1.status).toBe(200);
      expect(res1.body.message).toContain("If the email is registered");

      // Verify token in DB
      const tokens = await testPool.query(
        "SELECT * FROM admin_password_reset_tokens WHERE admin_user_id = $1",
        [adminId],
      );
      expect(tokens.rowCount).toBe(1);
      expect(tokens.rows[0].used_at).toBeNull();

      // Unknown email returns same message
      const res2 = await request(app)
        .post("/api/v1/auth/admin/forgot-password")
        .send({ email: "nonexistent@test.local" });

      expect(res2.status).toBe(200);
      expect(res2.body.message).toBe(res1.body.message);
    });

    it("reset-password updates password, marks token used, and revokes all active refresh tokens", async () => {
      // Create an active session first
      const loginRes = await request(app)
        .post("/api/v1/auth/admin/login")
        .send({ email: adminEmail, password: TEST_PASSWORD });

      expect(loginRes.status).toBe(200);

      // Request reset token
      const rawToken = "sample_plain_reset_token_32chars";
      const tokenHash = hashSha256(rawToken);
      await testPool.query(
        `INSERT INTO admin_password_reset_tokens (admin_user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + interval '1 hour')`,
        [adminId, tokenHash],
      );

      const NEW_PASSWORD = "BrandNewPassword999!";
      const resetRes = await request(app)
        .post("/api/v1/auth/admin/reset-password")
        .send({ token: rawToken, newPassword: NEW_PASSWORD });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.message).toContain("Password successfully reset");

      // Verify token marked used
      const tokenRow = await testPool.query(
        "SELECT used_at FROM admin_password_reset_tokens WHERE token_hash = $1",
        [tokenHash],
      );
      expect(tokenRow.rows[0].used_at).not.toBeNull();

      // Verify previous session refresh tokens were revoked
      const activeTokens = await testPool.query(
        "SELECT * FROM refresh_tokens WHERE admin_user_id = $1 AND revoked_at IS NULL",
        [adminId],
      );
      expect(activeTokens.rowCount).toBe(0);

      // Verify audit log admin.password_changed created
      const audit = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'admin.password_changed' AND actor_id = $1",
        [adminId],
      );
      expect(audit.rowCount).toBe(1);

      // Old password no longer works
      const oldLogin = await request(app)
        .post("/api/v1/auth/admin/login")
        .send({ email: adminEmail, password: TEST_PASSWORD });
      expect(oldLogin.status).toBe(401);

      // New password works
      const newLogin = await request(app)
        .post("/api/v1/auth/admin/login")
        .send({ email: adminEmail, password: NEW_PASSWORD });
      expect(newLogin.status).toBe(200);
    });

    it("rejects already used reset token with 400", async () => {
      const rawToken = "already_used_token";
      const tokenHash = hashSha256(rawToken);
      await testPool.query(
        `INSERT INTO admin_password_reset_tokens (admin_user_id, token_hash, expires_at, used_at)
         VALUES ($1, $2, now() + interval '1 hour', now() - interval '5 minutes')`,
        [adminId, tokenHash],
      );

      const res = await request(app)
        .post("/api/v1/auth/admin/reset-password")
        .send({ token: rawToken, newPassword: "NewPassword123" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_OR_EXPIRED_RESET_TOKEN");
    });

    it("rejects new password shorter than 8 characters with 422", async () => {
      const res = await request(app)
        .post("/api/v1/auth/admin/reset-password")
        .send({ token: "some_token", newPassword: "short" });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });
});
