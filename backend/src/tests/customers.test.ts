import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { testPool, ensureTestDatabaseMigrated, truncateAllTables } from "./test-db.js";
import { hashPassword, hashSha256, signAccessToken } from "../common/utils/crypto.js";
import { DEFAULT_GROUP_ID, seedDefaultGroup } from "../seeds/default-group.seed.js";

describe("Admin Customers Management Integration Tests", () => {
  const PASSWORD = "AdminPassword123!";
  let adminId: string;
  let adminToken: string;
  let goldGroupId: string;

  beforeAll(async () => {
    await ensureTestDatabaseMigrated();
  });

  beforeEach(async () => {
    await truncateAllTables();

    // 1. Seed Default Group
    await seedDefaultGroup(testPool);

    // 2. Create a Secondary Group (Gold Tier)
    const groupRes = await testPool.query(
      `INSERT INTO groups (name, discount_percent, description, active, is_default)
       VALUES ('Gold Tier', 5.00, '5% discount group', TRUE, FALSE)
       RETURNING id`,
    );
    goldGroupId = groupRes.rows[0].id;

    // 3. Seed Super Admin
    const passwordHash = await hashPassword(PASSWORD);
    const res = await testPool.query(
      `INSERT INTO admin_users (name, email, phone, password_hash, role, location, initials, is_active)
       VALUES ('Admin Vikram', 'vikram@fuelpoint.local', '+919876543210', $1, 'Super Admin', 'HQ Station', 'AV', TRUE)
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
  // 1. Auth & Role Guards
  // ============================================================================
  describe("Auth & Role Guards", () => {
    it("returns 401 when Authorization header is missing", async () => {
      const res = await request(app).get("/api/v1/admin/customers");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("MISSING_TOKEN");
    });

    it("returns 403 when called by a worker", async () => {
      const workerToken = signAccessToken({
        sub: "00000000-0000-0000-0000-000000000011",
        role: "worker",
        aud: "fuelpoint-worker",
      });

      const res = await request(app)
        .get("/api/v1/admin/customers")
        .set("Authorization", `Bearer ${workerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 when called by a customer", async () => {
      const customerToken = signAccessToken({
        sub: "00000000-0000-0000-0000-000000000022",
        role: "customer",
        aud: "fuelpoint-customer",
      });

      const res = await request(app)
        .get("/api/v1/admin/customers")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  // ============================================================================
  // 2. POST /api/v1/admin/customers (Create Customer)
  // ============================================================================
  describe("POST /api/v1/admin/customers", () => {
    it("creates a customer, normalizes phone and email, generates qr_token, writes audit log, and creates NO notification", async () => {
      const payload = {
        name: "Ramesh Sharma",
        phone: "9876543211", // 10 digits without +91
        email: "  Ramesh.Sharma@Example.COM  ",
        vehicle: "MH-12-AB-1234",
        groupId: goldGroupId,
      };

      const res = await request(app)
        .post("/api/v1/admin/customers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.customer).toBeDefined();

      const created = res.body.customer;
      expect(created.name).toBe("Ramesh Sharma");
      expect(created.phone).toBe("+919876543211"); // E.164 normalized
      expect(created.email).toBe("ramesh.sharma@example.com"); // Lowercased & trimmed
      expect(created.vehicle).toBe("MH-12-AB-1234");
      expect(created.groupId).toBe(goldGroupId);
      expect(created.groupName).toBe("Gold Tier");
      expect(created.status).toBe("active");
      expect(created.transactions).toBe(0);
      expect(created.totalSpend).toBe("0.00");
      expect(created.discountReceived).toBe("0.00");

      // Verify in DB that qr_token is generated and has >= 128 bits randomness
      const dbRow = await testPool.query("SELECT qr_token, status FROM customers WHERE id = $1", [
        created.id,
      ]);
      expect(dbRow.rowCount).toBe(1);
      const token = dbRow.rows[0].qr_token;
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThanOrEqual(24);
      expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);

      // Verify audit log entry written in DB
      const auditRes = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'customer.created' AND entity_id = $1",
        [created.id],
      );
      expect(auditRes.rowCount).toBe(1);
      expect(auditRes.rows[0].actor_type).toBe("admin");
      expect(auditRes.rows[0].actor_id).toBe(adminId);
      expect(auditRes.rows[0].new_value.phone).toBe("+919876543211");

      // Verify RULE: Admin-created customer creates NO notification
      const notifRes = await testPool.query("SELECT * FROM notifications WHERE customer_id = $1", [
        created.id,
      ]);
      expect(notifRes.rowCount).toBe(0);
    });

    it("defaults to Default Group when groupId is omitted", async () => {
      const res = await request(app)
        .post("/api/v1/admin/customers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Default Customer",
          phone: "9123456780",
        });

      expect(res.status).toBe(201);
      expect(res.body.customer.groupId).toBe(DEFAULT_GROUP_ID);
      expect(res.body.customer.groupName).toBe("Standard (Default)");
    });

    it("rejects duplicate phone number with 409 Conflict", async () => {
      await request(app)
        .post("/api/v1/admin/customers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "User One", phone: "9876543212" });

      const res = await request(app)
        .post("/api/v1/admin/customers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "User Two", phone: "+919876543212" }); // same phone formatted

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("PHONE_ALREADY_EXISTS");
    });

    it("rejects duplicate email with 409 Conflict", async () => {
      await request(app)
        .post("/api/v1/admin/customers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "User One", phone: "9876543213", email: "common@test.com" });

      const res = await request(app)
        .post("/api/v1/admin/customers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "User Two", phone: "9876543214", email: "COMMON@TEST.COM" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
    });

    it("rejects invalid Indian phone format with 400 Bad Request", async () => {
      const res = await request(app)
        .post("/api/v1/admin/customers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Invalid Phone", phone: "1234567890" }); // starts with 1

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_PHONE");
    });

    it("returns 404 when non-existent groupId is specified", async () => {
      const res = await request(app)
        .post("/api/v1/admin/customers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Ghost Group",
          phone: "9876543215",
          groupId: "00000000-0000-0000-0000-000000000999",
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("GROUP_NOT_FOUND");
    });
  });

  // ============================================================================
  // 3. GET /api/v1/admin/customers (List, Filtering, Search, Aggregates)
  // ============================================================================
  describe("GET /api/v1/admin/customers", () => {
    let customer1Id: string;
    let customer2Id: string;

    beforeEach(async () => {
      // Create Customer 1 (Active, Gold Tier)
      const c1 = await testPool.query(
        `INSERT INTO customers (name, phone, email, vehicle, qr_token, group_id, status)
         VALUES ('Aarav Patel', '+919811111111', 'aarav@patel.in', 'GJ-01-XX-1111', 'qr_aarav', $1, 'active')
         RETURNING id`,
        [goldGroupId],
      );
      customer1Id = c1.rows[0].id;

      // Create Customer 2 (Inactive, Default Group)
      const c2 = await testPool.query(
        `INSERT INTO customers (name, phone, email, vehicle, qr_token, group_id, status)
         VALUES ('Bhavin Shah', '+919822222222', 'bhavin@shah.in', 'GJ-01-YY-2222', 'qr_bhavin', $1, 'inactive')
         RETURNING id`,
        [DEFAULT_GROUP_ID],
      );
      customer2Id = c2.rows[0].id;

      // Create Customer 3 (Soft-deleted, should NOT appear)
      await testPool.query(
        `INSERT INTO customers (name, phone, email, vehicle, qr_token, group_id, status, deleted_at)
         VALUES ('Deleted Dave', '+919833333333', 'deleted@dave.in', 'GJ-01-ZZ-3333', 'qr_deleted', $1, 'active', now())`,
        [goldGroupId],
      );

      // Create a Worker for transaction seeding
      const wRes = await testPool.query(
        `INSERT INTO workers (name, email, phone, shift, status)
         VALUES ('Pramod Worker', 'pramod@worker.local', '+919777777777', 'Morning', 'active')
         RETURNING id`,
      );
      const workerId = wRes.rows[0].id;

      // Add transactions to Customer 1:
      // 1 successful transaction: amount 1000, discount 50
      await testPool.query(
        `INSERT INTO transactions (customer_id, worker_id, group_id, status, amount, discount_percent, discount_amount, submitted_at, resolved_at)
         VALUES ($1, $2, $3, 'success', 1000.00, 5.00, 50.00, now(), now())`,
        [customer1Id, workerId, goldGroupId],
      );

      // 1 failed transaction: amount 500 (should NOT count in aggregates)
      await testPool.query(
        `INSERT INTO transactions (customer_id, worker_id, group_id, status, amount, discount_percent, discount_amount, submitted_at, resolved_at)
         VALUES ($1, $2, $3, 'failed', 500.00, 5.00, 25.00, now(), now())`,
        [customer1Id, workerId, goldGroupId],
      );

      // 1 pending transaction: amount 300 (should NOT count in aggregates)
      await testPool.query(
        `INSERT INTO transactions (customer_id, worker_id, group_id, status, amount, discount_percent, discount_amount, submitted_at)
         VALUES ($1, $2, $3, 'pending', 300.00, 5.00, 15.00, now())`,
        [customer1Id, workerId, goldGroupId],
      );
    });

    it("returns paginated list with aggregates counting SUCCESS transactions only", async () => {
      const res = await request(app)
        .get("/api/v1/admin/customers")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.total).toBe(2);

      const c1 = res.body.data.find((c: { id: string }) => c.id === customer1Id);
      expect(c1).toBeDefined();
      expect(c1.transactions).toBe(1); // Only the 1 success transaction
      expect(c1.totalSpend).toBe("1000.00");
      expect(c1.discountReceived).toBe("50.00");

      const c2 = res.body.data.find((c: { id: string }) => c.id === customer2Id);
      expect(c2).toBeDefined();
      expect(c2.transactions).toBe(0);
      expect(c2.totalSpend).toBe("0.00");
    });

    it("filters customers by status=inactive", async () => {
      const res = await request(app)
        .get("/api/v1/admin/customers?status=inactive")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(customer2Id);
      expect(res.body.data[0].status).toBe("inactive");
    });

    it("filters customers by group_id", async () => {
      const res = await request(app)
        .get(`/api/v1/admin/customers?group_id=${goldGroupId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(customer1Id);
      expect(res.body.data[0].groupName).toBe("Gold Tier");
    });

    it("searches customers across name, phone, email, and vehicle with query q", async () => {
      const res = await request(app)
        .get("/api/v1/admin/customers?q=bhavin")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe("Bhavin Shah");
    });
  });

  // ============================================================================
  // 4. GET /api/v1/admin/customers/:id (Detail & Recent Transactions)
  // ============================================================================
  describe("GET /api/v1/admin/customers/:id", () => {
    it("returns customer details including qrToken and recent transactions list", async () => {
      const cRes = await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id, status)
         VALUES ('Deepak Verma', '+919866666666', 'qr_deepak_secret', $1, 'active')
         RETURNING id`,
        [goldGroupId],
      );
      const customerId = cRes.rows[0].id;

      const res = await request(app)
        .get(`/api/v1/admin/customers/${customerId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.customer).toBeDefined();
      expect(res.body.customer.id).toBe(customerId);
      expect(res.body.customer.qrToken).toBe("qr_deepak_secret");
      expect(res.body.customer.groupName).toBe("Gold Tier");
      expect(Array.isArray(res.body.recentTransactions)).toBe(true);
    });

    it("returns 404 when customer does not exist", async () => {
      const res = await request(app)
        .get("/api/v1/admin/customers/00000000-0000-0000-0000-000000000999")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("CUSTOMER_NOT_FOUND");
    });
  });

  // ============================================================================
  // 5. PATCH /api/v1/admin/customers/:id (Edit Customer)
  // ============================================================================
  describe("PATCH /api/v1/admin/customers/:id", () => {
    it("updates customer fields and writes customer.updated audit log", async () => {
      const cRes = await testPool.query(
        `INSERT INTO customers (name, phone, email, vehicle, qr_token, group_id, status)
         VALUES ('Kiran Rao', '+919877777777', 'kiran@rao.in', 'DL-01-A-1234', 'qr_kiran', $1, 'active')
         RETURNING id`,
        [DEFAULT_GROUP_ID],
      );
      const customerId = cRes.rows[0].id;

      const res = await request(app)
        .patch(`/api/v1/admin/customers/${customerId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Kiran S. Rao",
          phone: "9888888888", // new phone
          email: "KIRAN.RAO@NEWDOMAIN.COM", // lowercase
          vehicle: "DL-01-B-5678",
        });

      expect(res.status).toBe(200);
      expect(res.body.customer.name).toBe("Kiran S. Rao");
      expect(res.body.customer.phone).toBe("+919888888888");
      expect(res.body.customer.email).toBe("kiran.rao@newdomain.com");
      expect(res.body.customer.vehicle).toBe("DL-01-B-5678");

      // Verify audit entry
      const auditRes = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'customer.updated' AND entity_id = $1",
        [customerId],
      );
      expect(auditRes.rowCount).toBe(1);
      expect(auditRes.rows[0].old_value.name).toBe("Kiran Rao");
      expect(auditRes.rows[0].new_value.name).toBe("Kiran S. Rao");
    });

    it("rejects duplicate phone when updating to an existing phone number", async () => {
      await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id)
         VALUES ('Existing Customer', '+919855555555', 'qr_exist', $1)`,
        [DEFAULT_GROUP_ID],
      );

      const targetRes = await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id)
         VALUES ('Target Customer', '+919844444444', 'qr_target', $1)
         RETURNING id`,
        [DEFAULT_GROUP_ID],
      );
      const targetId = targetRes.rows[0].id;

      const res = await request(app)
        .patch(`/api/v1/admin/customers/${targetId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ phone: "9855555555" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("PHONE_ALREADY_EXISTS");
    });
  });

  // ============================================================================
  // 6. PATCH /api/v1/admin/customers/:id/status (Status & Token Revocation)
  // ============================================================================
  describe("PATCH /api/v1/admin/customers/:id/status", () => {
    it("updates status to inactive AND immediately revokes customer refresh tokens", async () => {
      const cRes = await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id, status)
         VALUES ('Token Holder', '+919899999999', 'qr_tokens', $1, 'active')
         RETURNING id`,
        [DEFAULT_GROUP_ID],
      );
      const customerId = cRes.rows[0].id;

      // Seed an active refresh token for this customer
      const tokenHash = hashSha256("customer_raw_refresh_token_123");
      await testPool.query(
        `INSERT INTO refresh_tokens (token_hash, customer_id, expires_at)
         VALUES ($1, $2, now() + interval '30 days')`,
        [tokenHash, customerId],
      );

      // Verify active token exists
      const before = await testPool.query(
        "SELECT * FROM refresh_tokens WHERE customer_id = $1 AND revoked_at IS NULL",
        [customerId],
      );
      expect(before.rowCount).toBe(1);

      // Deactivate customer
      const res = await request(app)
        .patch(`/api/v1/admin/customers/${customerId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "inactive" });

      expect(res.status).toBe(200);
      expect(res.body.customer.status).toBe("inactive");

      // Verify RULE: Refresh tokens revoked immediately!
      const after = await testPool.query(
        "SELECT * FROM refresh_tokens WHERE customer_id = $1 AND revoked_at IS NULL",
        [customerId],
      );
      expect(after.rowCount).toBe(0);

      // Verify audit log
      const auditRes = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'customer.status_changed' AND entity_id = $1",
        [customerId],
      );
      expect(auditRes.rowCount).toBe(1);
      expect(auditRes.rows[0].old_status).toBe("active");
      expect(auditRes.rows[0].new_status).toBe("inactive");
    });
  });

  // ============================================================================
  // 7. PATCH /api/v1/admin/customers/:id/group (Reassign Group)
  // ============================================================================
  describe("PATCH /api/v1/admin/customers/:id/group", () => {
    it("reassigns customer to a new group and writes customer.group_assigned audit log", async () => {
      const cRes = await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id, status)
         VALUES ('Reassign Me', '+919800000000', 'qr_reassign', $1, 'active')
         RETURNING id`,
        [DEFAULT_GROUP_ID],
      );
      const customerId = cRes.rows[0].id;

      const res = await request(app)
        .patch(`/api/v1/admin/customers/${customerId}/group`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ groupId: goldGroupId });

      expect(res.status).toBe(200);
      expect(res.body.customer.groupId).toBe(goldGroupId);
      expect(res.body.customer.groupName).toBe("Gold Tier");

      // Verify audit log
      const auditRes = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'customer.group_assigned' AND entity_id = $1",
        [customerId],
      );
      expect(auditRes.rowCount).toBe(1);
      expect(auditRes.rows[0].new_value.old_group_id).toBe(DEFAULT_GROUP_ID);
      expect(auditRes.rows[0].new_value.new_group_id).toBe(goldGroupId);
      expect(auditRes.rows[0].new_value.group_name).toBe("Gold Tier");
    });

    it("returns 404 when target group does not exist", async () => {
      const cRes = await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id)
         VALUES ('Test Cust', '+919800000001', 'qr_test', $1)
         RETURNING id`,
        [DEFAULT_GROUP_ID],
      );

      const res = await request(app)
        .patch(`/api/v1/admin/customers/${cRes.rows[0].id}/group`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ groupId: "00000000-0000-0000-0000-000000000999" });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("GROUP_NOT_FOUND");
    });
  });

  // ============================================================================
  // 8. DELETE /api/v1/admin/customers/:id (Soft Delete & Token Revocation)
  // ============================================================================
  describe("DELETE /api/v1/admin/customers/:id", () => {
    it("soft deletes customer, revokes refresh tokens, and records customer.deleted audit", async () => {
      const cRes = await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id, status)
         VALUES ('To Be Deleted', '+919800000002', 'qr_delete', $1, 'active')
         RETURNING id`,
        [DEFAULT_GROUP_ID],
      );
      const customerId = cRes.rows[0].id;

      // Seed refresh token
      await testPool.query(
        `INSERT INTO refresh_tokens (token_hash, customer_id, expires_at)
         VALUES ($1, $2, now() + interval '30 days')`,
        [hashSha256("token_for_deleted_customer"), customerId],
      );

      const res = await request(app)
        .delete(`/api/v1/admin/customers/${customerId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("Customer deleted successfully");

      // Verify soft deleted in DB
      const dbRow = await testPool.query("SELECT deleted_at FROM customers WHERE id = $1", [
        customerId,
      ]);
      expect(dbRow.rows[0].deleted_at).not.toBeNull();

      // Verify tokens revoked
      const tokens = await testPool.query(
        "SELECT * FROM refresh_tokens WHERE customer_id = $1 AND revoked_at IS NULL",
        [customerId],
      );
      expect(tokens.rowCount).toBe(0);

      // Verify audit log
      const auditRes = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'customer.deleted' AND entity_id = $1",
        [customerId],
      );
      expect(auditRes.rowCount).toBe(1);
      expect(auditRes.rows[0].new_value.name).toBe("To Be Deleted");

      // Verify customer no longer returned in list
      const listRes = await request(app)
        .get("/api/v1/admin/customers")
        .set("Authorization", `Bearer ${adminToken}`);

      const found = listRes.body.data.find((c: { id: string }) => c.id === customerId);
      expect(found).toBeUndefined();
    });

    it("returns 404 when customer to delete does not exist", async () => {
      const res = await request(app)
        .delete("/api/v1/admin/customers/00000000-0000-0000-0000-000000000999")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("CUSTOMER_NOT_FOUND");
    });
  });
});
