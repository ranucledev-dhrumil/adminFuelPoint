import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { testPool, ensureTestDatabaseMigrated, truncateAllTables } from "./test-db.js";
import { hashPassword, hashSha256, signAccessToken } from "../common/utils/crypto.js";
import { DEFAULT_GROUP_ID, seedDefaultGroup } from "../seeds/default-group.seed.js";

describe("Admin Workers Management Integration Tests", () => {
  const PASSWORD = "AdminPassword123!";
  let adminId: string;
  let adminToken: string;

  beforeAll(async () => {
    await ensureTestDatabaseMigrated();
  });

  beforeEach(async () => {
    await truncateAllTables();

    // 1. Seed Default Group
    await seedDefaultGroup(testPool);

    // 2. Seed Super Admin
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
      const res = await request(app).get("/api/v1/admin/workers");
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
        .get("/api/v1/admin/workers")
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
        .get("/api/v1/admin/workers")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  // ============================================================================
  // 2. POST /api/v1/admin/workers (Create Worker)
  // ============================================================================
  describe("POST /api/v1/admin/workers", () => {
    it("creates a worker, normalizes phone and email, defaults status to active, and writes audit log", async () => {
      const payload = {
        name: "Rajesh Kumar",
        phone: "9876543211", // 10 digits
        email: "Rajesh.Kumar@FuelPoint.Local", // mixed case
        shift: "Morning",
      };

      const res = await request(app)
        .post("/api/v1/admin/workers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.worker).toBeDefined();
      expect(res.body.worker.id).toBeDefined();
      expect(res.body.worker.name).toBe("Rajesh Kumar");
      expect(res.body.worker.phone).toBe("+919876543211");
      expect(res.body.worker.email).toBe("rajesh.kumar@fuelpoint.local");
      expect(res.body.worker.shift).toBe("Morning");
      expect(res.body.worker.status).toBe("active");
      expect(res.body.worker.firstLoginAt).toBeNull();
      expect(res.body.worker.scans).toBe(0);
      expect(res.body.worker.transactions).toBe(0);
      expect(res.body.worker.customersScanned).toBe(0);
      expect(res.body.worker.discountProcessed).toBe("0.00");

      // Verify audit log
      const auditRes = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'worker.created' AND entity_id = $1",
        [res.body.worker.id],
      );
      expect(auditRes.rowCount).toBe(1);
      expect(auditRes.rows[0].actor_type).toBe("admin");
      expect(auditRes.rows[0].actor_id).toBe(adminId);
      expect(auditRes.rows[0].actor_name).toBe("Admin Vikram");
      expect(auditRes.rows[0].new_value.phone).toBe("+919876543211");
      expect(auditRes.rows[0].new_value.email).toBe("rajesh.kumar@fuelpoint.local");
      expect(auditRes.rows[0].new_value.shift).toBe("Morning");
    });

    it("rejects duplicate phone with 409 Conflict", async () => {
      await request(app)
        .post("/api/v1/admin/workers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Attendant One",
          phone: "9876543212",
          email: "attendant1@test.local",
          shift: "Morning",
        });

      const res = await request(app)
        .post("/api/v1/admin/workers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Attendant Two",
          phone: "+919876543212",
          email: "attendant2@test.local",
          shift: "Evening",
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("PHONE_ALREADY_EXISTS");
    });

    it("rejects duplicate email with 409 Conflict", async () => {
      await request(app)
        .post("/api/v1/admin/workers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Attendant One",
          phone: "9876543213",
          email: "same@worker.local",
          shift: "Morning",
        });

      const res = await request(app)
        .post("/api/v1/admin/workers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Attendant Two",
          phone: "9876543214",
          email: "SAME@WORKER.LOCAL",
          shift: "Night",
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
    });

    it("rejects invalid Indian phone format with 400 Bad Request", async () => {
      const res = await request(app)
        .post("/api/v1/admin/workers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Bad Phone",
          phone: "1234567890", // starts with 1
          email: "bad@test.local",
          shift: "Morning",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_PHONE");
    });

    it("rejects invalid email format with validation error", async () => {
      const res = await request(app)
        .post("/api/v1/admin/workers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Bad Email",
          phone: "9876543215",
          email: "not-an-email",
          shift: "Morning",
        });

      expect([400, 422]).toContain(res.status);
    });

    it("rejects invalid shift value with validation error", async () => {
      const res = await request(app)
        .post("/api/v1/admin/workers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Bad Shift",
          phone: "9876543216",
          email: "shift@test.local",
          shift: "Graveyard",
        });

      expect([400, 422]).toContain(res.status);
    });
  });

  // ============================================================================
  // 3. GET /api/v1/admin/workers (List, Filters, Search, Aggregates)
  // ============================================================================
  describe("GET /api/v1/admin/workers", () => {
    let worker1Id: string;
    let worker2Id: string;
    let customer1Id: string;
    let customer2Id: string;

    beforeEach(async () => {
      // 1. Create two customers for transaction tests
      const c1 = await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id, status)
         VALUES ('Customer One', '+919811111111', 'qr_c1', $1, 'active')
         RETURNING id`,
        [DEFAULT_GROUP_ID],
      );
      customer1Id = c1.rows[0].id;

      const c2 = await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id, status)
         VALUES ('Customer Two', '+919822222222', 'qr_c2', $1, 'active')
         RETURNING id`,
        [DEFAULT_GROUP_ID],
      );
      customer2Id = c2.rows[0].id;

      // 2. Worker 1: Morning, active
      const w1 = await testPool.query(
        `INSERT INTO workers (name, email, phone, shift, status)
         VALUES ('Suresh Raina', 'suresh@pump.local', '+919833333333', 'Morning', 'active')
         RETURNING id`,
      );
      worker1Id = w1.rows[0].id;

      // 3. Worker 2: Night, offline
      const w2 = await testPool.query(
        `INSERT INTO workers (name, email, phone, shift, status)
         VALUES ('Dinesh Karthik', 'dinesh@pump.local', '+919844444444', 'Night', 'offline')
         RETURNING id`,
      );
      worker2Id = w2.rows[0].id;

      // 4. Worker 3: Soft-deleted (should not appear in lists)
      await testPool.query(
        `INSERT INTO workers (name, email, phone, shift, status, deleted_at)
         VALUES ('Ghost Worker', 'ghost@pump.local', '+919855555555', 'Evening', 'active', now())`,
      );

      // 5. Seed transactions for Worker 1:
      // Transaction 1: success, amount 1000, discount 50, customer1
      await testPool.query(
        `INSERT INTO transactions (customer_id, worker_id, group_id, status, amount, discount_percent, discount_amount, fuel_type, litres, submitted_at, resolved_at)
         VALUES ($1, $2, $3, 'success', 1000.00, 5.00, 50.00, 'Petrol', 10.00, now() - interval '2 hours', now() - interval '2 hours')`,
        [customer1Id, worker1Id, DEFAULT_GROUP_ID],
      );

      // Transaction 2: success, amount 2000, discount 100, customer2
      await testPool.query(
        `INSERT INTO transactions (customer_id, worker_id, group_id, status, amount, discount_percent, discount_amount, fuel_type, litres, submitted_at, resolved_at)
         VALUES ($1, $2, $3, 'success', 2000.00, 5.00, 100.00, 'Diesel', 22.00, now() - interval '1 hour', now() - interval '1 hour')`,
        [customer2Id, worker1Id, DEFAULT_GROUP_ID],
      );

      // Transaction 3: failed, amount 500, discount 25 (scans count, but not transactions/discountProcessed)
      await testPool.query(
        `INSERT INTO transactions (customer_id, worker_id, group_id, status, amount, discount_percent, discount_amount, fuel_type, litres, submitted_at, resolved_at)
         VALUES ($1, $2, $3, 'failed', 500.00, 5.00, 25.00, 'CNG', 6.00, now() - interval '30 minutes', now() - interval '30 minutes')`,
        [customer1Id, worker1Id, DEFAULT_GROUP_ID],
      );

      // Transaction 4: pending, amount 300, discount 15 (scans count, but not transactions/discountProcessed)
      await testPool.query(
        `INSERT INTO transactions (customer_id, worker_id, group_id, status, amount, discount_percent, discount_amount, fuel_type, litres, submitted_at)
         VALUES ($1, $2, $3, 'pending', 300.00, 5.00, 15.00, 'Petrol', 3.00, now())`,
        [customer1Id, worker1Id, DEFAULT_GROUP_ID],
      );
    });

    it("returns paginated list with accurate scan, transaction, and discount aggregates", async () => {
      const res = await request(app)
        .get("/api/v1/admin/workers")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.total).toBe(2);

      const w1 = res.body.data.find((w: { id: string }) => w.id === worker1Id);
      expect(w1).toBeDefined();
      expect(w1.scans).toBe(4); // 4 total submitted transactions
      expect(w1.transactions).toBe(2); // 2 success transactions
      expect(w1.customersScanned).toBe(2); // customer1 and customer2
      expect(w1.discountProcessed).toBe("150.00"); // 50.00 + 100.00

      const w2 = res.body.data.find((w: { id: string }) => w.id === worker2Id);
      expect(w2).toBeDefined();
      expect(w2.scans).toBe(0);
      expect(w2.transactions).toBe(0);
      expect(w2.customersScanned).toBe(0);
      expect(w2.discountProcessed).toBe("0.00");
    });

    it("filters workers by status=offline", async () => {
      const res = await request(app)
        .get("/api/v1/admin/workers?status=offline")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(worker2Id);
      expect(res.body.data[0].status).toBe("offline");
    });

    it("filters workers by shift=Night", async () => {
      const res = await request(app)
        .get("/api/v1/admin/workers?shift=Night")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(worker2Id);
      expect(res.body.data[0].shift).toBe("Night");
    });

    it("searches workers across name, phone, or email using q", async () => {
      const res = await request(app)
        .get("/api/v1/admin/workers?q=suresh")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(worker1Id);
      expect(res.body.data[0].name).toBe("Suresh Raina");
    });

    it("sorts workers by scans descending", async () => {
      const res = await request(app)
        .get("/api/v1/admin/workers?sort_by=scans&order=desc")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data[0].id).toBe(worker1Id);
      expect(res.body.data[1].id).toBe(worker2Id);
    });
  });

  // ============================================================================
  // 4. GET /api/v1/admin/workers/:id (Worker Detail & Recent Transactions)
  // ============================================================================
  describe("GET /api/v1/admin/workers/:id", () => {
    it("returns worker details along with recent transactions", async () => {
      const w = await testPool.query(
        `INSERT INTO workers (name, email, phone, shift, status)
         VALUES ('Hardik Pandya', 'hardik@pump.local', '+919866666666', 'Evening', 'active')
         RETURNING id`,
      );
      const workerId = w.rows[0].id;

      const c = await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id)
         VALUES ('Jasprit Bumrah', '+919877777777', 'qr_jasprit', $1)
         RETURNING id`,
        [DEFAULT_GROUP_ID],
      );
      const customerId = c.rows[0].id;

      await testPool.query(
        `INSERT INTO transactions (customer_id, worker_id, group_id, status, amount, discount_percent, discount_amount, fuel_type, litres, submitted_at, resolved_at)
         VALUES ($1, $2, $3, 'success', 1500.00, 5.00, 75.00, 'Petrol', 15.00, now(), now())`,
        [customerId, workerId, DEFAULT_GROUP_ID],
      );

      const res = await request(app)
        .get(`/api/v1/admin/workers/${workerId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.worker).toBeDefined();
      expect(res.body.worker.id).toBe(workerId);
      expect(res.body.worker.name).toBe("Hardik Pandya");
      expect(res.body.worker.createdAt).toBeDefined();
      expect(res.body.worker.updatedAt).toBeDefined();

      expect(res.body.recentTransactions).toBeDefined();
      expect(res.body.recentTransactions.length).toBe(1);
      expect(res.body.recentTransactions[0].amount).toBe("1500.00");
      expect(res.body.recentTransactions[0].discountAmount).toBe("75.00");
      expect(res.body.recentTransactions[0].netPayable).toBe("1425.00");
      expect(res.body.recentTransactions[0].fuel).toBe("Petrol");
      expect(res.body.recentTransactions[0].litres).toBe("15.00");
      expect(res.body.recentTransactions[0].customerId).toBe(customerId);
      expect(res.body.recentTransactions[0].customerName).toBe("Jasprit Bumrah");
    });

    it("returns 404 when worker is not found", async () => {
      const res = await request(app)
        .get("/api/v1/admin/workers/00000000-0000-0000-0000-000000000999")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("WORKER_NOT_FOUND");
    });
  });

  // ============================================================================
  // 5. PATCH /api/v1/admin/workers/:id (Update Worker)
  // ============================================================================
  describe("PATCH /api/v1/admin/workers/:id", () => {
    it("updates worker fields, normalizes phone and email, and writes audit log", async () => {
      const w = await testPool.query(
        `INSERT INTO workers (name, email, phone, shift, status)
         VALUES ('Ravi Bishnoi', 'ravi@pump.local', '+919888888881', 'Morning', 'active')
         RETURNING id`,
      );
      const workerId = w.rows[0].id;

      const res = await request(app)
        .patch(`/api/v1/admin/workers/${workerId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Ravi K. Bishnoi",
          phone: "9888888882",
          email: "RAVI.UPDATED@PUMP.LOCAL",
          shift: "Night",
        });

      expect(res.status).toBe(200);
      expect(res.body.worker.name).toBe("Ravi K. Bishnoi");
      expect(res.body.worker.phone).toBe("+919888888882");
      expect(res.body.worker.email).toBe("ravi.updated@pump.local");
      expect(res.body.worker.shift).toBe("Night");

      // Verify audit log
      const auditRes = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'worker.updated' AND entity_id = $1",
        [workerId],
      );
      expect(auditRes.rowCount).toBe(1);
      expect(auditRes.rows[0].old_value.name).toBe("Ravi Bishnoi");
      expect(auditRes.rows[0].new_value.name).toBe("Ravi K. Bishnoi");
      expect(auditRes.rows[0].new_value.shift).toBe("Night");
    });

    it("rejects duplicate phone when updating to an existing phone", async () => {
      await testPool.query(
        `INSERT INTO workers (name, email, phone, shift, status)
         VALUES ('Worker A', 'a@pump.local', '+919888888883', 'Morning', 'active')`,
      );

      const w2 = await testPool.query(
        `INSERT INTO workers (name, email, phone, shift, status)
         VALUES ('Worker B', 'b@pump.local', '+919888888884', 'Morning', 'active')
         RETURNING id`,
      );
      const worker2Id = w2.rows[0].id;

      const res = await request(app)
        .patch(`/api/v1/admin/workers/${worker2Id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ phone: "9888888883" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("PHONE_ALREADY_EXISTS");
    });

    it("rejects duplicate email when updating to an existing email", async () => {
      await testPool.query(
        `INSERT INTO workers (name, email, phone, shift, status)
         VALUES ('Worker C', 'c@pump.local', '+919888888885', 'Morning', 'active')`,
      );

      const w4 = await testPool.query(
        `INSERT INTO workers (name, email, phone, shift, status)
         VALUES ('Worker D', 'd@pump.local', '+919888888886', 'Morning', 'active')
         RETURNING id`,
      );
      const worker4Id = w4.rows[0].id;

      const res = await request(app)
        .patch(`/api/v1/admin/workers/${worker4Id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ email: "C@PUMP.LOCAL" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
    });
  });

  // ============================================================================
  // 6. PATCH /api/v1/admin/workers/:id/status (Status & Token Revocation Rules)
  // ============================================================================
  describe("PATCH /api/v1/admin/workers/:id/status", () => {
    it("updates status to offline WITHOUT revoking refresh tokens", async () => {
      const w = await testPool.query(
        `INSERT INTO workers (name, email, phone, shift, status)
         VALUES ('Status Worker 1', 'status1@pump.local', '+919899999991', 'Morning', 'active')
         RETURNING id`,
      );
      const workerId = w.rows[0].id;

      // Seed active refresh token
      const tokenHash = hashSha256("worker_token_raw_1");
      await testPool.query(
        `INSERT INTO refresh_tokens (token_hash, worker_id, expires_at)
         VALUES ($1, $2, now() + interval '30 days')`,
        [tokenHash, workerId],
      );

      const res = await request(app)
        .patch(`/api/v1/admin/workers/${workerId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "offline" });

      expect(res.status).toBe(200);
      expect(res.body.worker.status).toBe("offline");

      // Verify RULE: setting offline does NOT revoke refresh tokens
      const tokenCheck = await testPool.query(
        "SELECT * FROM refresh_tokens WHERE worker_id = $1 AND revoked_at IS NULL",
        [workerId],
      );
      expect(tokenCheck.rowCount).toBe(1);

      // Verify audit log
      const auditRes = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'worker.status_changed' AND entity_id = $1",
        [workerId],
      );
      expect(auditRes.rowCount).toBe(1);
      expect(auditRes.rows[0].old_status).toBe("active");
      expect(auditRes.rows[0].new_status).toBe("offline");
    });

    it("updates status to suspended AND explicitly revokes active refresh tokens", async () => {
      const w = await testPool.query(
        `INSERT INTO workers (name, email, phone, shift, status)
         VALUES ('Status Worker 2', 'status2@pump.local', '+919899999992', 'Morning', 'offline')
         RETURNING id`,
      );
      const workerId = w.rows[0].id;

      // Seed active refresh token
      const tokenHash = hashSha256("worker_token_raw_2");
      await testPool.query(
        `INSERT INTO refresh_tokens (token_hash, worker_id, expires_at)
         VALUES ($1, $2, now() + interval '30 days')`,
        [tokenHash, workerId],
      );

      const res = await request(app)
        .patch(`/api/v1/admin/workers/${workerId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "suspended" });

      expect(res.status).toBe(200);
      expect(res.body.worker.status).toBe("suspended");

      // Verify RULE: suspending worker revokes all active refresh tokens!
      const tokenCheck = await testPool.query(
        "SELECT * FROM refresh_tokens WHERE worker_id = $1 AND revoked_at IS NULL",
        [workerId],
      );
      expect(tokenCheck.rowCount).toBe(0);

      // Verify audit log
      const auditRes = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'worker.status_changed' AND entity_id = $1",
        [workerId],
      );
      expect(auditRes.rowCount).toBe(1);
      expect(auditRes.rows[0].old_status).toBe("offline");
      expect(auditRes.rows[0].new_status).toBe("suspended");
    });
  });

  // ============================================================================
  // 7. DELETE /api/v1/admin/workers/:id (Soft Delete & Token Revocation)
  // ============================================================================
  describe("DELETE /api/v1/admin/workers/:id", () => {
    it("soft deletes worker, revokes refresh tokens, and records audit log", async () => {
      const w = await testPool.query(
        `INSERT INTO workers (name, email, phone, shift, status)
         VALUES ('Delete Worker', 'delete@pump.local', '+919899999993', 'Morning', 'active')
         RETURNING id`,
      );
      const workerId = w.rows[0].id;

      // Seed active refresh token
      const tokenHash = hashSha256("worker_token_raw_3");
      await testPool.query(
        `INSERT INTO refresh_tokens (token_hash, worker_id, expires_at)
         VALUES ($1, $2, now() + interval '30 days')`,
        [tokenHash, workerId],
      );

      const res = await request(app)
        .delete(`/api/v1/admin/workers/${workerId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Worker deleted successfully");

      // Verify worker has deleted_at set in DB
      const dbWorker = await testPool.query("SELECT * FROM workers WHERE id = $1", [workerId]);
      expect(dbWorker.rows[0].deleted_at).not.toBeNull();

      // Verify refresh tokens are revoked
      const tokenCheck = await testPool.query(
        "SELECT * FROM refresh_tokens WHERE worker_id = $1 AND revoked_at IS NULL",
        [workerId],
      );
      expect(tokenCheck.rowCount).toBe(0);

      // Verify audit log
      const auditRes = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'worker.deleted' AND entity_id = $1",
        [workerId],
      );
      expect(auditRes.rowCount).toBe(1);
      expect(auditRes.rows[0].actor_type).toBe("admin");
      expect(auditRes.rows[0].actor_id).toBe(adminId);

      // Subsequent GET returns 404
      const getRes = await request(app)
        .get(`/api/v1/admin/workers/${workerId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(getRes.status).toBe(404);
    });

    it("returns 404 when worker is already deleted or not found", async () => {
      const res = await request(app)
        .delete("/api/v1/admin/workers/00000000-0000-0000-0000-000000000999")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("WORKER_NOT_FOUND");
    });
  });
});
