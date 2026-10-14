import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { testPool, ensureTestDatabaseMigrated, truncateAllTables } from "./test-db.js";
import { signAccessToken } from "../common/utils/crypto.js";
import { DEFAULT_GROUP_ID } from "../seeds/default-group.seed.js";

describe("Mobile Profile Endpoints Integration Tests (Task 23)", () => {
  let activeCustomerId: string;
  let activeCustomerToken: string;
  let inactiveCustomerId: string;
  let inactiveCustomerToken: string;
  let softDeletedCustomerId: string;
  let softDeletedCustomerToken: string;

  let activeWorkerId: string;
  let activeWorkerToken: string;
  let offlineWorkerId: string;
  let offlineWorkerToken: string;
  let suspendedWorkerId: string;
  let suspendedWorkerToken: string;

  let adminToken: string;

  beforeAll(async () => {
    await ensureTestDatabaseMigrated();
  });

  beforeEach(async () => {
    await truncateAllTables();

    // 1. Seed default group
    await testPool.query(
      `INSERT INTO groups (id, name, discount_percent, active, is_default)
       VALUES ($1, 'Standard (Default)', 0.00, TRUE, TRUE)
       ON CONFLICT (id) DO NOTHING;`,
      [DEFAULT_GROUP_ID],
    );

    // 2. Seed a custom group
    const customGroupRes = await testPool.query(
      `INSERT INTO groups (name, discount_percent, active, is_default)
       VALUES ('Gold Tier', 5.00, TRUE, FALSE)
       RETURNING id;`,
    );
    const customGroupId = customGroupRes.rows[0].id;

    // 3. Seed active customer
    const activeCustRes = await testPool.query(
      `INSERT INTO customers (name, phone, email, vehicle, qr_token, group_id, status)
       VALUES ('Aarav Patel', '+919876543210', 'aarav@example.com', 'MH12AB1234', 'qr_active_cust', $1, 'active')
       RETURNING id;`,
      [customGroupId],
    );
    activeCustomerId = activeCustRes.rows[0].id;
    activeCustomerToken = signAccessToken({
      sub: activeCustomerId,
      role: "customer",
      aud: "fuelpoint-customer",
    });

    // 4. Seed inactive customer
    const inactiveCustRes = await testPool.query(
      `INSERT INTO customers (name, phone, email, vehicle, qr_token, group_id, status)
       VALUES ('Inactive Cust', '+919876543211', 'inactive@example.com', NULL, 'qr_inact_cust', $1, 'inactive')
       RETURNING id;`,
      [DEFAULT_GROUP_ID],
    );
    inactiveCustomerId = inactiveCustRes.rows[0].id;
    inactiveCustomerToken = signAccessToken({
      sub: inactiveCustomerId,
      role: "customer",
      aud: "fuelpoint-customer",
    });

    // 5. Seed soft-deleted customer
    const softDelCustRes = await testPool.query(
      `INSERT INTO customers (name, phone, email, vehicle, qr_token, group_id, status, deleted_at)
       VALUES ('Deleted Cust', '+919876543212', 'deleted@example.com', NULL, 'qr_del_cust', $1, 'active', NOW())
       RETURNING id;`,
      [DEFAULT_GROUP_ID],
    );
    softDeletedCustomerId = softDelCustRes.rows[0].id;
    softDeletedCustomerToken = signAccessToken({
      sub: softDeletedCustomerId,
      role: "customer",
      aud: "fuelpoint-customer",
    });

    // 6. Seed another customer to test duplicate email conflict
    await testPool.query(
      `INSERT INTO customers (name, phone, email, vehicle, qr_token, group_id, status)
       VALUES ('Rohan Gupta', '+919876543299', 'rohan@example.com', NULL, 'qr_rohan_cust', $1, 'active');`,
      [DEFAULT_GROUP_ID],
    );

    // 7. Seed active worker
    const activeWorkerRes = await testPool.query(
      `INSERT INTO workers (name, phone, email, shift, status)
       VALUES ('Rajesh Kumar', '+919811122233', 'rajesh@pump.local', 'Morning', 'active')
       RETURNING id;`,
    );
    activeWorkerId = activeWorkerRes.rows[0].id;
    activeWorkerToken = signAccessToken({
      sub: activeWorkerId,
      role: "worker",
      aud: "fuelpoint-worker",
    });

    // 8. Seed offline worker
    const offlineWorkerRes = await testPool.query(
      `INSERT INTO workers (name, phone, email, shift, status)
       VALUES ('Suresh Off', '+919811122244', 'suresh@pump.local', 'Evening', 'offline')
       RETURNING id;`,
    );
    offlineWorkerId = offlineWorkerRes.rows[0].id;
    offlineWorkerToken = signAccessToken({
      sub: offlineWorkerId,
      role: "worker",
      aud: "fuelpoint-worker",
    });

    // 9. Seed suspended worker
    const suspendedWorkerRes = await testPool.query(
      `INSERT INTO workers (name, phone, email, shift, status)
       VALUES ('Mahesh Susp', '+919811122255', 'mahesh@pump.local', 'Night', 'suspended')
       RETURNING id;`,
    );
    suspendedWorkerId = suspendedWorkerRes.rows[0].id;
    suspendedWorkerToken = signAccessToken({
      sub: suspendedWorkerId,
      role: "worker",
      aud: "fuelpoint-worker",
    });

    // 10. Seed active admin (for testing wrong role rejection)
    const adminRes = await testPool.query(
      `INSERT INTO admin_users (name, email, password_hash, role, initials, is_active)
       VALUES ('Admin Test', 'admin@fuelpoint.test', 'hash', 'Super Admin', 'AT', TRUE)
       RETURNING id;`,
    );
    const adminId = adminRes.rows[0].id;
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
  // 1. GET /api/v1/customer/profile
  // ============================================================================
  describe("GET /api/v1/customer/profile", () => {
    it("returns 401 when token is missing", async () => {
      const res = await request(app).get("/api/v1/customer/profile");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("MISSING_TOKEN");
    });

    it("returns 403 for wrong role (worker token)", async () => {
      const res = await request(app)
        .get("/api/v1/customer/profile")
        .set("Authorization", `Bearer ${activeWorkerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 for wrong role (admin token)", async () => {
      const res = await request(app)
        .get("/api/v1/customer/profile")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when customer is inactive", async () => {
      const res = await request(app)
        .get("/api/v1/customer/profile")
        .set("Authorization", `Bearer ${inactiveCustomerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("CUSTOMER_INACTIVE");
    });

    it("returns 403 when customer is soft-deleted", async () => {
      const res = await request(app)
        .get("/api/v1/customer/profile")
        .set("Authorization", `Bearer ${softDeletedCustomerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("CUSTOMER_INACTIVE");
    });

    it("returns 200 with complete customer profile including groupName", async () => {
      const res = await request(app)
        .get("/api/v1/customer/profile")
        .set("Authorization", `Bearer ${activeCustomerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: activeCustomerId,
        name: "Aarav Patel",
        phone: "+919876543210",
        email: "aarav@example.com",
        vehicle: "MH12AB1234",
        status: "active",
        groupName: "Gold Tier",
      });
    });
  });

  // ============================================================================
  // 2. PATCH /api/v1/customer/profile
  // ============================================================================
  describe("PATCH /api/v1/customer/profile", () => {
    it("returns 401 when token is missing", async () => {
      const res = await request(app)
        .patch("/api/v1/customer/profile")
        .send({ name: "Updated Name" });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("MISSING_TOKEN");
    });

    it("returns 403 for wrong role", async () => {
      const res = await request(app)
        .patch("/api/v1/customer/profile")
        .set("Authorization", `Bearer ${activeWorkerToken}`)
        .send({ name: "Updated Name" });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when customer is inactive", async () => {
      const res = await request(app)
        .patch("/api/v1/customer/profile")
        .set("Authorization", `Bearer ${inactiveCustomerToken}`)
        .send({ name: "Updated Name" });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("CUSTOMER_INACTIVE");
    });

    it("returns 422 for invalid input: empty body", async () => {
      const res = await request(app)
        .patch("/api/v1/customer/profile")
        .set("Authorization", `Bearer ${activeCustomerToken}`)
        .send({});
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 422 for invalid input: empty name string", async () => {
      const res = await request(app)
        .patch("/api/v1/customer/profile")
        .set("Authorization", `Bearer ${activeCustomerToken}`)
        .send({ name: "" });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 422 for invalid input: malformed email", async () => {
      const res = await request(app)
        .patch("/api/v1/customer/profile")
        .set("Authorization", `Bearer ${activeCustomerToken}`)
        .send({ email: "invalid-email-address" });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 409 Conflict when new email is already in use by another customer", async () => {
      const res = await request(app)
        .patch("/api/v1/customer/profile")
        .set("Authorization", `Bearer ${activeCustomerToken}`)
        .send({ email: "rohan@example.com" });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
    });

    it("ensures phone is not changeable even when supplied in request body", async () => {
      const originalPhone = "+919876543210";
      const res = await request(app)
        .patch("/api/v1/customer/profile")
        .set("Authorization", `Bearer ${activeCustomerToken}`)
        .send({
          name: "Aarav P. Updated",
          phone: "+919999988888", // attempt to change phone
        });

      expect(res.status).toBe(200);
      expect(res.body.customer.name).toBe("Aarav P. Updated");
      expect(res.body.customer.phone).toBe(originalPhone);

      // Verify directly from the database that phone remained unchanged
      const dbCust = await testPool.query("SELECT phone FROM customers WHERE id = $1", [
        activeCustomerId,
      ]);
      expect(dbCust.rows[0].phone).toBe(originalPhone);
    });

    it("returns 422 when ONLY phone is supplied with no editable fields", async () => {
      const res = await request(app)
        .patch("/api/v1/customer/profile")
        .set("Authorization", `Bearer ${activeCustomerToken}`)
        .send({ phone: "+919999988888" });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("successfully updates name, email (lower-cased), and vehicle, and records customer.updated audit log", async () => {
      const res = await request(app)
        .patch("/api/v1/customer/profile")
        .set("Authorization", `Bearer ${activeCustomerToken}`)
        .send({
          name: "Aarav M. Patel",
          email: "AARAV.NEW@EXAMPLE.COM",
          vehicle: "DL01XY9999",
        });

      expect(res.status).toBe(200);
      expect(res.body.customer).toEqual({
        id: activeCustomerId,
        name: "Aarav M. Patel",
        phone: "+919876543210",
        email: "aarav.new@example.com", // lower-cased
        vehicle: "DL01XY9999",
        status: "active",
      });

      // Verify audit log entry written in the same transaction
      const auditRes = await testPool.query(
        `SELECT action, actor_type, actor_id, entity_type, entity_id, old_value, new_value
         FROM audit_logs
         WHERE entity_id = $1 AND action = 'customer.updated'
         ORDER BY created_at DESC
         LIMIT 1;`,
        [activeCustomerId],
      );

      expect(auditRes.rows.length).toBe(1);
      const auditRow = auditRes.rows[0];
      expect(auditRow.action).toBe("customer.updated");
      expect(auditRow.actor_type).toBe("customer");
      expect(auditRow.actor_id).toBe(activeCustomerId);
      expect(auditRow.entity_type).toBe("customer");
      expect(auditRow.entity_id).toBe(activeCustomerId);

      expect(auditRow.old_value).toEqual({
        name: "Aarav Patel",
        email: "aarav@example.com",
        vehicle: "MH12AB1234",
      });
      expect(auditRow.new_value).toEqual({
        name: "Aarav M. Patel",
        email: "aarav.new@example.com",
        vehicle: "DL01XY9999",
      });
    });
  });

  // ============================================================================
  // 3. GET /api/v1/worker/profile
  // ============================================================================
  describe("GET /api/v1/worker/profile", () => {
    it("returns 401 when token is missing", async () => {
      const res = await request(app).get("/api/v1/worker/profile");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("MISSING_TOKEN");
    });

    it("returns 403 for wrong role (customer token)", async () => {
      const res = await request(app)
        .get("/api/v1/worker/profile")
        .set("Authorization", `Bearer ${activeCustomerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 for wrong role (admin token)", async () => {
      const res = await request(app)
        .get("/api/v1/worker/profile")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when worker is offline", async () => {
      const res = await request(app)
        .get("/api/v1/worker/profile")
        .set("Authorization", `Bearer ${offlineWorkerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("WORKER_NOT_ACTIVE");
    });

    it("returns 403 when worker is suspended", async () => {
      const res = await request(app)
        .get("/api/v1/worker/profile")
        .set("Authorization", `Bearer ${suspendedWorkerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("WORKER_SUSPENDED");
    });

    it("returns 200 with complete worker profile when worker is active", async () => {
      const res = await request(app)
        .get("/api/v1/worker/profile")
        .set("Authorization", `Bearer ${activeWorkerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: activeWorkerId,
        name: "Rajesh Kumar",
        phone: "+919811122233",
        email: "rajesh@pump.local",
        shift: "Morning",
        status: "active",
      });
      expect(res.body.joinedAt).toBeDefined();
      expect(new Date(res.body.joinedAt).getTime()).not.toBeNaN();
    });
  });
});
