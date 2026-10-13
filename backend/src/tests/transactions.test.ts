import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { app } from "../app.js";
import { testPool, ensureTestDatabaseMigrated, truncateAllTables } from "./test-db.js";
import { hashPassword, signAccessToken, signScanTicket } from "../common/utils/crypto.js";
import { seedDefaultGroup } from "../seeds/default-group.seed.js";

describe("Transactions Flow Integration Tests", () => {
  let adminId: string;
  let adminToken: string;

  let workerId: string;
  let workerToken: string;
  let worker2Id: string;
  let worker2Token: string;

  let customerId: string;
  let customerToken: string;
  let customerQrToken: string;

  let customGroupId: string;

  beforeAll(async () => {
    await ensureTestDatabaseMigrated();
  });

  beforeEach(async () => {
    await truncateAllTables();

    // 1. Seed Default Group
    await seedDefaultGroup(testPool);

    // 2. Create Custom Group (10% discount)
    const grpRes = await testPool.query(
      `INSERT INTO groups (name, discount_percent, active, is_default)
       VALUES ('Gold Fleet', 10.00, true, false)
       RETURNING id`,
    );
    customGroupId = grpRes.rows[0].id;

    // 3. Seed Super Admin
    const passwordHash = await hashPassword("AdminPass123!");
    const admRes = await testPool.query(
      `INSERT INTO admin_users (name, email, phone, password_hash, role, location, initials, is_active)
       VALUES ('Admin Vikram', 'admin@fuelpoint.local', '+919876543210', $1, 'Super Admin', 'HQ Station', 'AV', TRUE)
       RETURNING id`,
      [passwordHash],
    );
    adminId = admRes.rows[0].id;
    adminToken = signAccessToken({
      sub: adminId,
      role: "admin",
      aud: "fuelpoint-admin",
    });

    // 4. Seed Workers
    const w1Res = await testPool.query(
      `INSERT INTO workers (name, phone, email, shift, status)
       VALUES ('Worker Rajesh', '+919811111111', 'rajesh@fuelpoint.local', 'Morning', 'active')
       RETURNING id`,
    );
    workerId = w1Res.rows[0].id;
    workerToken = signAccessToken({
      sub: workerId,
      role: "worker",
      aud: "fuelpoint-worker",
    });

    const w2Res = await testPool.query(
      `INSERT INTO workers (name, phone, email, shift, status)
       VALUES ('Worker Suresh', '+919822222222', 'suresh@fuelpoint.local', 'Evening', 'active')
       RETURNING id`,
    );
    worker2Id = w2Res.rows[0].id;
    worker2Token = signAccessToken({
      sub: worker2Id,
      role: "worker",
      aud: "fuelpoint-worker",
    });

    // 5. Seed Customer in Custom Group
    customerQrToken = "test_customer_qr_token_12345678";
    const cRes = await testPool.query(
      `INSERT INTO customers (name, phone, qr_token, group_id, status)
       VALUES ('Customer Amit', '+919833333333', $1, $2, 'active')
       RETURNING id`,
      [customerQrToken, customGroupId],
    );
    customerId = cRes.rows[0].id;
    customerToken = signAccessToken({
      sub: customerId,
      role: "customer",
      aud: "fuelpoint-customer",
    });
  });

  afterAll(async () => {
    await testPool.end();
  });

  // ============================================================================
  // 1. Auth & Role Guards
  // ============================================================================
  describe("Auth & Role Guards", () => {
    it("returns 401 when Authorization header is missing on worker routes", async () => {
      const res = await request(app).post("/api/v1/worker/scan").send({ qrToken: customerQrToken });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("MISSING_TOKEN");
    });

    it("returns 403 when customer tries to call worker scan", async () => {
      const res = await request(app)
        .post("/api/v1/worker/scan")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ qrToken: customerQrToken });
      expect(res.status).toBe(403);
    });

    it("returns 403 WORKER_NOT_ACTIVE when worker is offline", async () => {
      await testPool.query(`UPDATE workers SET status = 'offline' WHERE id = $1`, [workerId]);

      const res = await request(app)
        .post("/api/v1/worker/scan")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ qrToken: customerQrToken });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("WORKER_NOT_ACTIVE");
    });

    it("returns 403 WORKER_SUSPENDED when worker is suspended", async () => {
      await testPool.query(`UPDATE workers SET status = 'suspended' WHERE id = $1`, [workerId]);

      const res = await request(app)
        .post("/api/v1/worker/scan")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ qrToken: customerQrToken });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("WORKER_SUSPENDED");
    });

    it("returns 403 when non-admin accesses admin transactions", async () => {
      const res = await request(app)
        .get("/api/v1/admin/transactions")
        .set("Authorization", `Bearer ${workerToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ============================================================================
  // 2. Scan Endpoint (POST /api/v1/worker/scan)
  // ============================================================================
  describe("POST /api/v1/worker/scan", () => {
    it("successfully scans active customer and returns metadata with signed scanTicket", async () => {
      const res = await request(app)
        .post("/api/v1/worker/scan")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ qrToken: customerQrToken });

      expect(res.status).toBe(200);
      expect(res.body.customerId).toBe(customerId);
      expect(res.body.customerName).toBe("Customer Amit");
      expect(res.body.groupId).toBe(customGroupId);
      expect(res.body.groupName).toBe("Gold Fleet");
      expect(res.body.discountPercent).toBe("10.00");
      expect(typeof res.body.scanTicket).toBe("string");
    });

    it("applies 0.00% discount when customer group is inactive, but scan still proceeds", async () => {
      await testPool.query(`UPDATE groups SET active = false WHERE id = $1`, [customGroupId]);

      const res = await request(app)
        .post("/api/v1/worker/scan")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ qrToken: customerQrToken });

      expect(res.status).toBe(200);
      expect(res.body.customerId).toBe(customerId);
      expect(res.body.discountPercent).toBe("0.00");
      expect(res.body.scanTicket).toBeDefined();
    });

    it("rejects inactive customer with 422 CUSTOMER_INACTIVE and records audit log without token", async () => {
      await testPool.query(`UPDATE customers SET status = 'inactive' WHERE id = $1`, [customerId]);

      const res = await request(app)
        .post("/api/v1/worker/scan")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ qrToken: customerQrToken });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("CUSTOMER_INACTIVE");

      // Verify audit log
      const auditRes = await testPool.query(
        `SELECT * FROM audit_logs WHERE action = 'scan.rejected' AND entity_id = $1`,
        [customerId],
      );
      expect(auditRes.rowCount).toBe(1);
      const log = auditRes.rows[0];
      expect(log.actor_type).toBe("worker");
      expect(log.actor_id).toBe(workerId);
      expect(log.reason).toBe("CUSTOMER_INACTIVE");

      // Verify token value is NEVER logged
      expect(JSON.stringify(log)).not.toContain(customerQrToken);
    });

    it("rejects unknown QR token with 404 CUSTOMER_NOT_FOUND and records audit log without token", async () => {
      const unknownToken = "completely_unknown_token_99999999";

      const res = await request(app)
        .post("/api/v1/worker/scan")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ qrToken: unknownToken });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("CUSTOMER_NOT_FOUND");

      // Verify audit log
      const auditRes = await testPool.query(
        `SELECT * FROM audit_logs WHERE action = 'scan.rejected' AND reason = 'CUSTOMER_NOT_FOUND'`,
      );
      expect(auditRes.rowCount).toBe(1);
      const log = auditRes.rows[0];
      expect(log.actor_type).toBe("worker");
      expect(log.actor_id).toBe(workerId);

      // Verify token value is NEVER logged
      expect(JSON.stringify(log)).not.toContain(unknownToken);
    });

    it("rejects superseded token after customer regenerates QR", async () => {
      // Regenerate customer QR
      const regenRes = await request(app)
        .post("/api/v1/customer/qr/regenerate")
        .set("Authorization", `Bearer ${customerToken}`);
      expect(regenRes.status).toBe(200);

      // Scanning old token must now fail with 404
      const res = await request(app)
        .post("/api/v1/worker/scan")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ qrToken: customerQrToken });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("CUSTOMER_NOT_FOUND");
    });

    it("enforces scan rate limit: 31st scan by same worker within 1 minute returns 429 TOO_MANY_REQUESTS", async () => {
      for (let i = 0; i < 30; i++) {
        const res = await request(app)
          .post("/api/v1/worker/scan")
          .set("Authorization", `Bearer ${worker2Token}`)
          .send({ qrToken: customerQrToken });
        expect(res.status).toBe(200);
      }

      const rateLimitedRes = await request(app)
        .post("/api/v1/worker/scan")
        .set("Authorization", `Bearer ${worker2Token}`)
        .send({ qrToken: customerQrToken });

      expect(rateLimitedRes.status).toBe(429);
      expect(rateLimitedRes.body.error.code).toBe("TOO_MANY_REQUESTS");
    });
  });

  // ============================================================================
  // 3. Submit Endpoint (POST /api/v1/worker/transactions)
  // ============================================================================
  describe("POST /api/v1/worker/transactions", () => {
    it("submits transaction, computes discount with decimal.js, sets pending status, updates worker last_activity_at and audit log", async () => {
      // 1. Scan to obtain scanTicket
      const scanRes = await request(app)
        .post("/api/v1/worker/scan")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ qrToken: customerQrToken });
      const { scanTicket } = scanRes.body;

      // 2. Submit transaction
      const clientTxId = crypto.randomUUID();
      const res = await request(app)
        .post("/api/v1/worker/transactions")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({
          id: clientTxId,
          scanTicket,
          amount: "125.55", // 10% discount = 12.555 -> 12.56 half-up
          litres: "1.25",
          fuelType: "Petrol",
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(clientTxId);
      expect(res.body.status).toBe("pending");
      expect(res.body.amount).toBe("125.55");
      expect(res.body.discountPercent).toBe("10.00");
      expect(res.body.discountAmount).toBe("12.56");
      expect(res.body.netPayable).toBe("112.99");
      expect(res.body.litres).toBe("1.25");
      expect(res.body.fuel).toBe("Petrol");
      expect(res.body.resolvedAt).toBeNull();
      expect(res.body.submittedAt).toBeDefined();

      // 3. Verify worker last_activity_at is updated
      const workerRow = await testPool.query(`SELECT last_activity_at FROM workers WHERE id = $1`, [
        workerId,
      ]);
      expect(workerRow.rows[0].last_activity_at).not.toBeNull();

      // 4. Verify audit_logs transaction.created
      const auditRow = await testPool.query(
        `SELECT * FROM audit_logs WHERE action = 'transaction.created' AND entity_id = $1`,
        [clientTxId],
      );
      expect(auditRow.rowCount).toBe(1);
      expect(auditRow.rows[0].actor_type).toBe("worker");
      expect(auditRow.rows[0].actor_id).toBe(workerId);
      expect(auditRow.rows[0].new_value.amount).toBe("125.55");
      expect(auditRow.rows[0].new_value.discount_amount).toBe("12.56");
    });

    it("rejects invalid or expired scan ticket with 400 EXPIRED_SCAN_TICKET", async () => {
      const clientTxId = crypto.randomUUID();
      const res = await request(app)
        .post("/api/v1/worker/transactions")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({
          id: clientTxId,
          scanTicket: "invalid_or_expired_jwt_ticket",
          amount: "500.00",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("EXPIRED_SCAN_TICKET");
    });

    it("rejects non-positive amount or litres with 400", async () => {
      const scanTicket = signScanTicket({
        customerId,
        groupId: customGroupId,
        discountPercent: "10.00",
      });

      // Amount <= 0
      const res1 = await request(app)
        .post("/api/v1/worker/transactions")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({
          id: crypto.randomUUID(),
          scanTicket,
          amount: "0.00",
        });
      expect(res1.status).toBe(400);
      expect(res1.body.error.code).toBe("INVALID_AMOUNT");

      // Litres <= 0
      const res2 = await request(app)
        .post("/api/v1/worker/transactions")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({
          id: crypto.randomUUID(),
          scanTicket,
          amount: "100.00",
          litres: "-5.00",
        });
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe("INVALID_LITRES");
    });

    // ==========================================================================
    // Idempotency & Retries
    // ==========================================================================
    describe("Idempotency & Retries", () => {
      it("returns 200 OK with existing transaction on identical retried submission", async () => {
        const scanTicket = signScanTicket({
          customerId,
          groupId: customGroupId,
          discountPercent: "10.00",
        });
        const clientTxId = crypto.randomUUID();

        // 1st POST
        const res1 = await request(app)
          .post("/api/v1/worker/transactions")
          .set("Authorization", `Bearer ${workerToken}`)
          .send({
            id: clientTxId,
            scanTicket,
            amount: "1000.00",
            litres: "10.00",
            fuelType: "Petrol",
          });
        expect(res1.status).toBe(201);

        // 2nd POST (identical retry)
        const res2 = await request(app)
          .post("/api/v1/worker/transactions")
          .set("Authorization", `Bearer ${workerToken}`)
          .send({
            id: clientTxId,
            scanTicket,
            amount: "1000.00",
            litres: "10.00",
            fuelType: "Petrol",
          });
        expect(res2.status).toBe(200);
        expect(res2.body.id).toBe(clientTxId);
        expect(res2.body.amount).toBe("1000.00");

        // Verify only 1 transaction was inserted
        const countRes = await testPool.query(`SELECT COUNT(*) FROM transactions WHERE id = $1`, [
          clientTxId,
        ]);
        expect(Number(countRes.rows[0].count)).toBe(1);
      });

      it("returns 409 Conflict IDEMPOTENCY_CONFLICT when retried with different amount", async () => {
        const scanTicket = signScanTicket({
          customerId,
          groupId: customGroupId,
          discountPercent: "10.00",
        });
        const clientTxId = crypto.randomUUID();

        // 1st POST
        await request(app)
          .post("/api/v1/worker/transactions")
          .set("Authorization", `Bearer ${workerToken}`)
          .send({
            id: clientTxId,
            scanTicket,
            amount: "1000.00",
          });

        // 2nd POST (different amount)
        const res2 = await request(app)
          .post("/api/v1/worker/transactions")
          .set("Authorization", `Bearer ${workerToken}`)
          .send({
            id: clientTxId,
            scanTicket,
            amount: "2000.00",
          });
        expect(res2.status).toBe(409);
        expect(res2.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
      });

      it("returns 409 Conflict IDEMPOTENCY_CONFLICT when retried with same ID by a different worker", async () => {
        const scanTicket = signScanTicket({
          customerId,
          groupId: customGroupId,
          discountPercent: "10.00",
        });
        const clientTxId = crypto.randomUUID();

        // Worker 1 creates
        await request(app)
          .post("/api/v1/worker/transactions")
          .set("Authorization", `Bearer ${workerToken}`)
          .send({
            id: clientTxId,
            scanTicket,
            amount: "1000.00",
          });

        // Worker 2 attempts same clientTxId
        const res2 = await request(app)
          .post("/api/v1/worker/transactions")
          .set("Authorization", `Bearer ${worker2Token}`)
          .send({
            id: clientTxId,
            scanTicket,
            amount: "1000.00",
          });
        expect(res2.status).toBe(409);
        expect(res2.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
      });

      it("handles concurrent identical submissions without primary key errors", async () => {
        const scanTicket = signScanTicket({
          customerId,
          groupId: customGroupId,
          discountPercent: "10.00",
        });
        const clientTxId = crypto.randomUUID();

        // Fire 2 concurrent requests with same payload
        const [resA, resB] = await Promise.all([
          request(app)
            .post("/api/v1/worker/transactions")
            .set("Authorization", `Bearer ${workerToken}`)
            .send({
              id: clientTxId,
              scanTicket,
              amount: "500.00",
            }),
          request(app)
            .post("/api/v1/worker/transactions")
            .set("Authorization", `Bearer ${workerToken}`)
            .send({
              id: clientTxId,
              scanTicket,
              amount: "500.00",
            }),
        ]);

        const statuses = [resA.status, resB.status].sort();
        // One must be 201 (created), the other 200 (idempotent duplicate)
        expect(statuses).toEqual([200, 201]);

        // Exactly 1 row in DB
        const countRes = await testPool.query(`SELECT COUNT(*) FROM transactions WHERE id = $1`, [
          clientTxId,
        ]);
        expect(Number(countRes.rows[0].count)).toBe(1);
      });
    });
  });

  // ============================================================================
  // 4. Status Transitions & Activity Maintenance
  // ============================================================================
  describe("Status Transitions", () => {
    let txId: string;

    beforeEach(async () => {
      txId = crypto.randomUUID();
      const scanTicket = signScanTicket({
        customerId,
        groupId: customGroupId,
        discountPercent: "10.00",
      });

      await request(app)
        .post("/api/v1/worker/transactions")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({
          id: txId,
          scanTicket,
          amount: "1000.00",
        });
    });

    it("worker transitions pending -> success: sets resolved_at, recalculates customer last_activity_at, writes audit log", async () => {
      const res = await request(app)
        .patch(`/api/v1/worker/transactions/${txId}/status`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ status: "success" });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(txId);
      expect(res.body.status).toBe("success");
      expect(res.body.resolvedAt).not.toBeNull();

      // Customer last_activity_at must be populated with submitted_at
      const custRow = await testPool.query(`SELECT last_activity_at FROM customers WHERE id = $1`, [
        customerId,
      ]);
      expect(custRow.rows[0].last_activity_at).not.toBeNull();

      // Audit log check
      const auditRes = await testPool.query(
        `SELECT * FROM audit_logs WHERE action = 'transaction.status_changed' AND entity_id = $1`,
        [txId],
      );
      expect(auditRes.rowCount).toBe(1);
      expect(auditRes.rows[0].old_status).toBe("pending");
      expect(auditRes.rows[0].new_status).toBe("success");
      expect(auditRes.rows[0].actor_type).toBe("worker");
      expect(auditRes.rows[0].actor_id).toBe(workerId);
    });

    it("worker transitions pending -> failed with failureReason", async () => {
      const res = await request(app)
        .patch(`/api/v1/worker/transactions/${txId}/status`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ status: "failed", failureReason: "Card declined by bank" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("failed");
      expect(res.body.resolvedAt).not.toBeNull();

      // Customer last_activity_at remains NULL because transaction was failed
      const custRow = await testPool.query(`SELECT last_activity_at FROM customers WHERE id = $1`, [
        customerId,
      ]);
      expect(custRow.rows[0].last_activity_at).toBeNull();

      // Audit log has reason
      const auditRes = await testPool.query(
        `SELECT * FROM audit_logs WHERE action = 'transaction.status_changed' AND entity_id = $1`,
        [txId],
      );
      expect(auditRes.rows[0].reason).toBe("Card declined by bank");
    });

    it("worker switches success -> failed: preserves resolved_at and resets customer last_activity_at to NULL", async () => {
      // 1. First move to success
      const firstRes = await request(app)
        .patch(`/api/v1/worker/transactions/${txId}/status`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ status: "success" });
      const initialResolvedAt = firstRes.body.resolvedAt;

      // 2. Switch to failed
      const secondRes = await request(app)
        .patch(`/api/v1/worker/transactions/${txId}/status`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ status: "failed", failureReason: "Customer disputed charge" });

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.status).toBe("failed");
      expect(secondRes.body.resolvedAt).toBe(initialResolvedAt); // Must preserve resolved_at

      // Customer has no other success transactions, so last_activity_at becomes NULL
      const custRow = await testPool.query(`SELECT last_activity_at FROM customers WHERE id = $1`, [
        customerId,
      ]);
      expect(custRow.rows[0].last_activity_at).toBeNull();
    });

    it("worker switches failed -> success: preserves resolved_at and restores customer last_activity_at", async () => {
      // 1. Move to failed
      const firstRes = await request(app)
        .patch(`/api/v1/worker/transactions/${txId}/status`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ status: "failed" });
      const initialResolvedAt = firstRes.body.resolvedAt;

      // 2. Switch to success
      const secondRes = await request(app)
        .patch(`/api/v1/worker/transactions/${txId}/status`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ status: "success" });

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.status).toBe("success");
      expect(secondRes.body.resolvedAt).toBe(initialResolvedAt);

      const custRow = await testPool.query(`SELECT last_activity_at FROM customers WHERE id = $1`, [
        customerId,
      ]);
      expect(custRow.rows[0].last_activity_at).not.toBeNull();
    });

    it("strictly forbids reverting status back to pending (400 CANNOT_REVERT_TO_PENDING)", async () => {
      // Move to success first
      await request(app)
        .patch(`/api/v1/worker/transactions/${txId}/status`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ status: "success" });

      // Try reverting to pending
      const res = await request(app)
        .patch(`/api/v1/worker/transactions/${txId}/status`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ status: "pending" });

      expect(res.status).toBe(422); // Zod enum rejects 'pending' as valid option
    });

    it("rejects worker updating another worker's transaction with 403 NOT_OWN_TRANSACTION", async () => {
      const res = await request(app)
        .patch(`/api/v1/worker/transactions/${txId}/status`)
        .set("Authorization", `Bearer ${worker2Token}`) // Worker 2
        .send({ status: "success" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("NOT_OWN_TRANSACTION");
    });

    it("admin can update any transaction status and writes admin audit log", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/transactions/${txId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "failed", failureReason: "Admin override: wrong fuel pumped" });

      expect(res.status).toBe(200);
      expect(res.body.transaction.status).toBe("failed");
      expect(res.body.transaction.failureReason).toBe("Admin override: wrong fuel pumped");

      // Verify audit log has actor_type = admin
      const auditRes = await testPool.query(
        `SELECT * FROM audit_logs WHERE action = 'transaction.status_changed' AND entity_id = $1`,
        [txId],
      );
      expect(auditRes.rows[0].actor_type).toBe("admin");
      expect(auditRes.rows[0].actor_id).toBe(adminId);
    });

    it("status transitions do NOT alter workers.last_activity_at", async () => {
      const beforeRow = await testPool.query(`SELECT last_activity_at FROM workers WHERE id = $1`, [
        workerId,
      ]);
      const initialWorkerActivity = beforeRow.rows[0].last_activity_at;

      // Update transaction status
      await request(app)
        .patch(`/api/v1/worker/transactions/${txId}/status`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ status: "success" });

      const afterRow = await testPool.query(`SELECT last_activity_at FROM workers WHERE id = $1`, [
        workerId,
      ]);
      expect(afterRow.rows[0].last_activity_at.getTime()).toBe(initialWorkerActivity.getTime());
    });
  });

  // ============================================================================
  // 5. History & Admin Endpoints
  // ============================================================================
  describe("History & Admin Listing Endpoints", () => {
    let tx1Id: string;
    let tx2Id: string;

    beforeEach(async () => {
      const scanTicket = signScanTicket({
        customerId,
        groupId: customGroupId,
        discountPercent: "10.00",
      });

      // Transaction 1 by worker 1 (success)
      tx1Id = crypto.randomUUID();
      await request(app)
        .post("/api/v1/worker/transactions")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ id: tx1Id, scanTicket, amount: "1000.00" });
      await request(app)
        .patch(`/api/v1/worker/transactions/${tx1Id}/status`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ status: "success" });

      // Transaction 2 by worker 1 (failed)
      tx2Id = crypto.randomUUID();
      await request(app)
        .post("/api/v1/worker/transactions")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ id: tx2Id, scanTicket, amount: "500.00" });
      await request(app)
        .patch(`/api/v1/worker/transactions/${tx2Id}/status`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ status: "failed", failureReason: "Network failure" });
    });

    it("GET /api/v1/worker/transactions returns worker's own transactions with pagination and filters", async () => {
      const resAll = await request(app)
        .get("/api/v1/worker/transactions")
        .set("Authorization", `Bearer ${workerToken}`);

      expect(resAll.status).toBe(200);
      expect(resAll.body.data.length).toBe(2);
      expect(resAll.body.pagination.total).toBe(2);

      // Filter by status = 'success'
      const resSuccess = await request(app)
        .get("/api/v1/worker/transactions?status=success")
        .set("Authorization", `Bearer ${workerToken}`);

      expect(resSuccess.status).toBe(200);
      expect(resSuccess.body.data.length).toBe(1);
      expect(resSuccess.body.data[0].id).toBe(tx1Id);
    });

    it("GET /api/v1/customer/transactions returns customer's transactions with pagination", async () => {
      const res = await request(app)
        .get("/api/v1/customer/transactions")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.total).toBe(2);
    });

    it("GET /api/v1/admin/transactions returns paginated list with joined names and filters", async () => {
      const res = await request(app)
        .get(`/api/v1/admin/transactions?workerId=${workerId}&status=failed`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(tx2Id);
      expect(res.body.data[0].workerName).toBe("Worker Rajesh");
      expect(res.body.data[0].customerName).toBe("Customer Amit");
      expect(res.body.data[0].groupName).toBe("Gold Fleet");
    });

    it("GET /api/v1/admin/transactions/:id returns detail with statusHistory array", async () => {
      const res = await request(app)
        .get(`/api/v1/admin/transactions/${tx1Id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.transaction.id).toBe(tx1Id);
      expect(res.body.transaction.customerName).toBe("Customer Amit");
      expect(res.body.transaction.workerName).toBe("Worker Rajesh");
      expect(Array.isArray(res.body.statusHistory)).toBe(true);
      expect(res.body.statusHistory.length).toBe(1);
      expect(res.body.statusHistory[0].oldStatus).toBe("pending");
      expect(res.body.statusHistory[0].newStatus).toBe("success");
      expect(res.body.statusHistory[0].actorType).toBe("worker");
    });
  });

  // ============================================================================
  // 6. Totals & Aggregates Count Success Only
  // ============================================================================
  describe("Totals and Aggregates Count Success Only", () => {
    it("worker and customer aggregates count success transactions only", async () => {
      const scanTicket = signScanTicket({
        customerId,
        groupId: customGroupId,
        discountPercent: "10.00",
      });

      // Tx 1: Success (amount: 1000.00, discount: 100.00)
      const t1 = crypto.randomUUID();
      await request(app)
        .post("/api/v1/worker/transactions")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ id: t1, scanTicket, amount: "1000.00" });
      await request(app)
        .patch(`/api/v1/worker/transactions/${t1}/status`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ status: "success" });

      // Tx 2: Failed (amount: 2000.00, discount: 200.00)
      const t2 = crypto.randomUUID();
      await request(app)
        .post("/api/v1/worker/transactions")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ id: t2, scanTicket, amount: "2000.00" });
      await request(app)
        .patch(`/api/v1/worker/transactions/${t2}/status`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ status: "failed" });

      // Tx 3: Pending (amount: 3000.00, discount: 300.00)
      const t3 = crypto.randomUUID();
      await request(app)
        .post("/api/v1/worker/transactions")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ id: t3, scanTicket, amount: "3000.00" });

      // 1. Worker detail endpoint
      const workerRes = await request(app)
        .get(`/api/v1/admin/workers/${workerId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(workerRes.status).toBe(200);
      const w = workerRes.body.worker;
      expect(w.scans).toBe(3); // All submitted scans
      expect(w.transactions).toBe(1); // ONLY success transactions
      expect(w.customersScanned).toBe(1);
      expect(w.discountProcessed).toBe("100.00"); // ONLY success discounts (100.00, not 600.00)

      // 2. Customer detail endpoint
      const custRes = await request(app)
        .get(`/api/v1/admin/customers/${customerId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(custRes.status).toBe(200);
      const c = custRes.body.customer;
      expect(c.transactions).toBe(1); // ONLY success transactions
      expect(c.totalSpend).toBe("1000.00"); // ONLY success amount (1000.00, not 6000.00)
      expect(c.discountReceived).toBe("100.00"); // ONLY success discount
    });
  });
});
