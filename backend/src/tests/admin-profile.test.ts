import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { testPool, ensureTestDatabaseMigrated, truncateAllTables } from "./test-db.js";
import { hashPassword, signAccessToken } from "../common/utils/crypto.js";

describe("Admin Profile & Password Change Integration Tests", () => {
  const PASSWORD = "InitialPassword123!";
  let adminId: string;
  let adminToken: string;

  beforeAll(async () => {
    await ensureTestDatabaseMigrated();
  });

  beforeEach(async () => {
    await truncateAllTables();

    const passwordHash = await hashPassword(PASSWORD);
    const res = await testPool.query(
      `INSERT INTO admin_users (name, email, phone, password_hash, role, location, initials, is_active)
       VALUES ('Manager Dave', 'dave@test.local', '+919876543210', $1, 'Super Admin', 'Station Office', 'MD', TRUE)
       RETURNING id`,
      [passwordHash],
    );
    adminId = res.rows[0].id;

    adminToken = signAccessToken({
      sub: adminId,
      role: "admin",
      aud: "fuelpoint-admin",
    });
  });

  afterAll(async () => {
    await testPool.end();
  });

  // ============================================================================
  // 1. GET /api/v1/admin/profile
  // ============================================================================
  describe("GET /api/v1/admin/profile", () => {
    it("returns 401 when token is missing", async () => {
      const res = await request(app).get("/api/v1/admin/profile");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("MISSING_TOKEN");
    });

    it("returns 403 when authenticated as a non-admin role", async () => {
      const workerToken = signAccessToken({
        sub: "00000000-0000-0000-0000-000000000099",
        role: "worker",
        aud: "fuelpoint-worker",
      });

      const res = await request(app)
        .get("/api/v1/admin/profile")
        .set("Authorization", `Bearer ${workerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when admin has been deactivated", async () => {
      await testPool.query("UPDATE admin_users SET is_active = FALSE WHERE id = $1", [adminId]);

      const res = await request(app)
        .get("/api/v1/admin/profile")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ADMIN_DEACTIVATED");
    });

    it("returns 200 with full admin profile when authorized", async () => {
      const res = await request(app)
        .get("/api/v1/admin/profile")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: adminId,
        name: "Manager Dave",
        email: "dave@test.local",
        phone: "+919876543210",
        role: "Super Admin",
        location: "Station Office",
        initials: "MD",
      });
      expect(res.body).not.toHaveProperty("password_hash");
    });
  });

  // ============================================================================
  // 2. PATCH /api/v1/admin/profile
  // ============================================================================
  describe("PATCH /api/v1/admin/profile", () => {
    it("updates profile, re-derives initials, normalizes phone, and records audit log", async () => {
      const res = await request(app)
        .patch("/api/v1/admin/profile")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Robert Stark",
          phone: "9123456789", // Bare 10 digits
          location: "HQ Sector 4",
        });

      expect(res.status).toBe(200);
      expect(res.body.profile).toMatchObject({
        name: "Robert Stark",
        initials: "RS",
        phone: "+919123456789", // Normalized
        location: "HQ Sector 4",
      });

      // Verify DB update
      const dbRow = await testPool.query("SELECT * FROM admin_users WHERE id = $1", [adminId]);
      expect(dbRow.rows[0].name).toBe("Robert Stark");
      expect(dbRow.rows[0].initials).toBe("RS");
      expect(dbRow.rows[0].phone).toBe("+919123456789");

      // Verify audit log admin.profile_updated created
      const audit = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'admin.profile_updated' AND actor_id = $1",
        [adminId],
      );
      expect(audit.rowCount).toBe(1);
      expect(audit.rows[0].old_value).toMatchObject({ name: "Manager Dave" });
      expect(audit.rows[0].new_value).toMatchObject({ name: "Robert Stark" });
    });

    it("rejects invalid Indian phone number with 400", async () => {
      const res = await request(app)
        .patch("/api/v1/admin/profile")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ phone: "12345" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_PHONE");
    });
  });

  // ============================================================================
  // 3. POST /api/v1/admin/profile/change-password
  // ============================================================================
  describe("POST /api/v1/admin/profile/change-password", () => {
    it("successfully changes password with correct current password", async () => {
      const NEW_PWD = "BrandNewPassword123!";

      const res = await request(app)
        .post("/api/v1/admin/profile/change-password")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          currentPassword: PASSWORD,
          newPassword: NEW_PWD,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Password changed successfully.");

      // Verify audit log admin.password_changed
      const audit = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'admin.password_changed' AND actor_id = $1",
        [adminId],
      );
      expect(audit.rowCount).toBe(1);

      // Verify login with new password succeeds
      const loginRes = await request(app).post("/api/v1/auth/admin/login").send({
        email: "dave@test.local",
        password: NEW_PWD,
      });
      expect(loginRes.status).toBe(200);
    });

    it("rejects incorrect current password with 400", async () => {
      const res = await request(app)
        .post("/api/v1/admin/profile/change-password")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          currentPassword: "WrongCurrentPassword",
          newPassword: "BrandNewPassword123!",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INCORRECT_PASSWORD");
    });

    it("rejects new password shorter than 8 characters with 422", async () => {
      const res = await request(app)
        .post("/api/v1/admin/profile/change-password")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          currentPassword: PASSWORD,
          newPassword: "short",
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });
});
