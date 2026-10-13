import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { app } from "../app.js";
import { testPool, ensureTestDatabaseMigrated, truncateAllTables } from "./test-db.js";
import { hashPassword, signAccessToken } from "../common/utils/crypto.js";
import { DEFAULT_GROUP_ID, seedDefaultGroup } from "../seeds/default-group.seed.js";
import { cleanupExpiredRecords } from "../jobs/cleanup-expired.job.js";

describe("Admin Analytics, Reports, Search, Notifications, Audit & Cleanup Integration Tests", () => {
  let adminId: string;
  let adminToken: string;
  let workerToken: string;

  let customGroupId: string;
  let customer1Id: string;
  let customer2Id: string;
  let worker1Id: string;
  let worker2Id: string;

  let notif1Id: string;

  beforeAll(async () => {
    await ensureTestDatabaseMigrated();
  });

  beforeEach(async () => {
    await truncateAllTables();

    // 1. Seed Default Group
    await seedDefaultGroup(testPool);

    // 2. Create Custom Group (8% discount)
    const grpRes = await testPool.query(
      `INSERT INTO groups (name, discount_percent, active, is_default)
       VALUES ('Silver Fleet', 8.00, true, false)
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
       VALUES ('Worker Amit', '+919811111111', 'amit@fuelpoint.local', 'Morning', 'active')
       RETURNING id`,
    );
    worker1Id = w1Res.rows[0].id;

    const w2Res = await testPool.query(
      `INSERT INTO workers (name, phone, email, shift, status)
       VALUES ('Worker Priya', '+919822222222', 'priya@fuelpoint.local', 'Evening', 'offline')
       RETURNING id`,
    );
    worker2Id = w2Res.rows[0].id;

    workerToken = signAccessToken({
      sub: worker1Id,
      role: "worker",
      aud: "fuelpoint-worker",
    });

    // 5. Seed Customers
    // Customer 1: Registered today, active, default group
    const c1Res = await testPool.query(
      `INSERT INTO customers (name, phone, email, qr_token, group_id, status, registered_at)
       VALUES ('Rahul Sharma', '+919833333333', 'rahul@example.com', 'qr_token_rahul', $1, 'active', now())
       RETURNING id`,
      [DEFAULT_GROUP_ID],
    );
    customer1Id = c1Res.rows[0].id;

    // Customer 2: Registered 10 days ago, inactive, Silver Fleet
    const c2Res = await testPool.query(
      `INSERT INTO customers (name, phone, email, qr_token, group_id, status, registered_at)
       VALUES ('Anjali Verma', '+919844444444', 'anjali@example.com', 'qr_token_anjali', $1, 'inactive', now() - interval '10 days')
       RETURNING id`,
      [customGroupId],
    );
    customer2Id = c2Res.rows[0].id;

    // 6. Seed Transactions
    // Tx 1: Success, today, Customer 1, Worker Amit, default group (0% discount)
    await testPool.query(
      `INSERT INTO transactions (customer_id, worker_id, group_id, status, amount, discount_percent, discount_amount, litres, fuel_type, submitted_at, resolved_at)
       VALUES ($1, $2, $3, 'success', 2000.00, 0.00, 0.00, 20.00, 'Petrol', now(), now())`,
      [customer1Id, worker1Id, DEFAULT_GROUP_ID],
    );

    // Tx 2: Success, today, Customer 2, Worker Amit, Silver Fleet (8% discount = 80.00)
    await testPool.query(
      `INSERT INTO transactions (customer_id, worker_id, group_id, status, amount, discount_percent, discount_amount, litres, fuel_type, submitted_at, resolved_at)
       VALUES ($1, $2, $3, 'success', 1000.00, 8.00, 80.00, 10.00, 'Diesel', now(), now())`,
      [customer2Id, worker1Id, customGroupId],
    );

    // Tx 3: Failed, today, Customer 2, Worker Priya, Silver Fleet
    await testPool.query(
      `INSERT INTO transactions (customer_id, worker_id, group_id, status, amount, discount_percent, discount_amount, litres, fuel_type, submitted_at, resolved_at)
       VALUES ($1, $2, $3, 'failed', 500.00, 8.00, 40.00, 5.00, 'Petrol', now(), now())`,
      [customer2Id, worker2Id, customGroupId],
    );

    // Tx 4: Success, 5 days ago, Customer 1, Worker Amit, default group
    await testPool.query(
      `INSERT INTO transactions (customer_id, worker_id, group_id, status, amount, discount_percent, discount_amount, litres, fuel_type, submitted_at, resolved_at)
       VALUES ($1, $2, $3, 'success', 1500.00, 0.00, 0.00, 15.00, 'Petrol', now() - interval '5 days', now() - interval '5 days')`,
      [customer1Id, worker1Id, DEFAULT_GROUP_ID],
    );

    // 7. Seed Notifications
    const n1Res = await testPool.query(
      `INSERT INTO notifications (type, title, message, is_read, created_at)
       VALUES ('registration', 'System Alert', 'Daily backup completed', false, now())
       RETURNING id`,
    );
    notif1Id = n1Res.rows[0].id;

    await testPool.query(
      `INSERT INTO notifications (type, title, message, is_read, created_at)
       VALUES ('worker', 'Shift Started', 'Worker Amit checked in', false, now())`,
    );

    await testPool.query(
      `INSERT INTO notifications (type, title, message, is_read, created_at)
       VALUES ('worker', 'Weekly Summary', 'Summary ready', true, now() - interval '2 days')`,
    );

    // 8. Seed Audit Logs
    await testPool.query(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, entity_type, entity_id, reason, created_at)
       VALUES ('worker', $1, 'Worker Amit', 'scan.rejected', 'transaction', gen_random_uuid(), 'CUSTOMER_INACTIVE', now())`,
      [worker1Id],
    );

    await testPool.query(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, entity_type, entity_id, reason, created_at)
       VALUES ('admin', $1, 'Admin Vikram', 'customer.created', 'customer', $2, NULL, now() - interval '5 days')`,
      [adminId, customer1Id],
    );
  });

  afterAll(async () => {
    await testPool.end();
  });

  // ============================================================================
  // 1. Dashboard Overview
  // ============================================================================
  describe("GET /api/v1/admin/dashboard/overview", () => {
    it("returns 401 when Authorization header is missing", async () => {
      const res = await request(app).get("/api/v1/admin/dashboard/overview");
      expect(res.status).toBe(401);
    });

    it("returns 403 when called by a worker", async () => {
      const res = await request(app)
        .get("/api/v1/admin/dashboard/overview")
        .set("Authorization", `Bearer ${workerToken}`);
      expect(res.status).toBe(403);
    });

    it("returns 200 with all 13 KPI fields accurately computed", async () => {
      const res = await request(app)
        .get("/api/v1/admin/dashboard/overview")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const overview = res.body;
      expect(overview).toBeDefined();

      // Customers
      expect(overview.totalCustomers).toBe(2);
      expect(overview.activeCustomers).toBe(1);
      expect(overview.unassignedCustomers).toBe(1);
      expect(overview.usedPumpCustomers).toBe(2);
      expect(overview.newRegistrations7d).toBe(1);

      // Workers
      expect(overview.totalWorkers).toBe(2);
      expect(overview.activeWorkers).toBe(1);

      // Groups
      expect(overview.totalGroups).toBe(2);

      // Transactions (only status = 'success')
      expect(overview.totalTransactions).toBe(3);
      expect(overview.totalDiscount).toBe("80.00");
      expect(overview.totalRevenue).toBe("4500.00");
      expect(overview.todayTransactions).toBe(2);
      expect(overview.todayDiscount).toBe("80.00");
    });
  });

  // ============================================================================
  // 2. Dashboard Series
  // ============================================================================
  describe("GET /api/v1/admin/dashboard/series", () => {
    it("returns 7 days series by default", async () => {
      const res = await request(app)
        .get("/api/v1/admin/dashboard/series")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.series).toBeInstanceOf(Array);
      expect(res.body.series).toHaveLength(7);

      // Last item is today
      const todayBucket = res.body.series[res.body.series.length - 1];
      expect(todayBucket).toHaveProperty("date");
      expect(todayBucket).toHaveProperty("label");
      expect(todayBucket.transactions).toBe(2);
      expect(todayBucket.discount).toBe("80.00");
      expect(todayBucket.revenue).toBe("3000.00");
      expect(todayBucket.registrations).toBe(1);
    });

    it("returns 30 days series when days=30", async () => {
      const res = await request(app)
        .get("/api/v1/admin/dashboard/series?days=30")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.series).toHaveLength(30);
    });

    it("returns 90 days series when days=90", async () => {
      const res = await request(app)
        .get("/api/v1/admin/dashboard/series?days=90")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.series).toHaveLength(90);
    });

    it("returns 422 for invalid non-integer days parameter", async () => {
      const res = await request(app)
        .get("/api/v1/admin/dashboard/series?days=notanumber")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // ============================================================================
  // 3. Worker Activity
  // ============================================================================
  describe("GET /api/v1/admin/dashboard/worker-activity", () => {
    it("returns worker activity ranked by scans", async () => {
      const res = await request(app)
        .get("/api/v1/admin/dashboard/worker-activity")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.workers).toBeInstanceOf(Array);
      expect(res.body.workers).toHaveLength(2);

      const amit = res.body.workers.find(
        (w: { name: string; scans: number; transactions: number }) => w.name === "Worker Amit",
      );
      expect(amit).toBeDefined();
      expect(amit.scans).toBe(3);
      expect(amit.transactions).toBe(3);

      const priya = res.body.workers.find(
        (w: { name: string; scans: number; transactions: number }) => w.name === "Worker Priya",
      );
      expect(priya).toBeDefined();
      expect(priya.scans).toBe(1);
      expect(priya.transactions).toBe(0); // Only failed transaction
    });
  });

  // ============================================================================
  // 4. Group Distribution
  // ============================================================================
  describe("GET /api/v1/admin/dashboard/group-distribution", () => {
    it("returns group breakdown with default group first", async () => {
      const res = await request(app)
        .get("/api/v1/admin/dashboard/group-distribution")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.groups).toBeInstanceOf(Array);
      expect(res.body.groups).toHaveLength(2);

      // Default group first
      const defaultGrp = res.body.groups[0];
      expect(defaultGrp.id).toBe(DEFAULT_GROUP_ID);
      expect(defaultGrp.customers).toBe(1);
      expect(defaultGrp.transactions).toBe(2);
      expect(defaultGrp.discountGenerated).toBe("0.00");

      // Silver fleet
      const silverGrp = res.body.groups[1];
      expect(silverGrp.name).toBe("Silver Fleet");
      expect(silverGrp.customers).toBe(1);
      expect(silverGrp.transactions).toBe(1);
      expect(silverGrp.discountGenerated).toBe("80.00");
    });
  });

  // ============================================================================
  // 5. Reports Summary
  // ============================================================================
  describe("GET /api/v1/admin/reports/summary", () => {
    it("returns 422 for invalid category", async () => {
      const res = await request(app)
        .get("/api/v1/admin/reports/summary?category=invalid")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(422);
    });

    it("returns summary for transactions category", async () => {
      const res = await request(app)
        .get("/api/v1/admin/reports/summary?category=transactions")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.category).toBe("transactions");
      expect(res.body.range).toBeDefined();
      expect(res.body.metrics).toBeInstanceOf(Array);
      expect(res.body.series).toBeInstanceOf(Array);

      const txMetric = res.body.metrics.find(
        (m: { label: string; value: string | number }) => m.label === "Transactions",
      );
      expect(txMetric.value).toBe(3);

      const revMetric = res.body.metrics.find(
        (m: { label: string; value: string | number }) => m.label === "Revenue",
      );
      expect(revMetric.value).toBe("4500.00");
    });

    it("returns summary for discount category", async () => {
      const res = await request(app)
        .get("/api/v1/admin/reports/summary?category=discount")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.category).toBe("discount");

      const discMetric = res.body.metrics.find(
        (m: { label: string; value: string | number }) => m.label === "Discount given",
      );
      expect(discMetric.value).toBe("80.00");

      const discScansMetric = res.body.metrics.find(
        (m: { label: string; value: string | number }) => m.label === "Discounted scans",
      );
      expect(discScansMetric.value).toBe(1);
    });

    it("returns summary for customers category", async () => {
      const res = await request(app)
        .get("/api/v1/admin/reports/summary?category=customers")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.category).toBe("customers");

      const regMetric = res.body.metrics.find(
        (m: { label: string; value: string | number }) => m.label === "New registrations",
      );
      expect(regMetric.value).toBe(2);
    });

    it("returns summary for workers category", async () => {
      const res = await request(app)
        .get("/api/v1/admin/reports/summary?category=workers")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.category).toBe("workers");

      const scansMetric = res.body.metrics.find(
        (m: { label: string; value: string | number }) => m.label === "Scans in range",
      );
      expect(scansMetric.value).toBe(4);
    });

    it("returns summary for groups category", async () => {
      const res = await request(app)
        .get("/api/v1/admin/reports/summary?category=groups")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.category).toBe("groups");

      const grpMetric = res.body.metrics.find(
        (m: { label: string; value: string | number }) => m.label === "Groups",
      );
      expect(grpMetric.value).toBe(2);
    });
  });

  // ============================================================================
  // 6. Reports Export (CSV Streaming)
  // ============================================================================
  describe("GET /api/v1/admin/reports/export", () => {
    it("returns 422 when category is missing or invalid", async () => {
      const res = await request(app)
        .get("/api/v1/admin/reports/export")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(422);
    });

    it("exports transactions CSV stream with headers and data rows", async () => {
      const res = await request(app)
        .get("/api/v1/admin/reports/export?category=transactions")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.header["content-type"]).toContain("text/csv");
      expect(res.header["content-disposition"]).toContain(
        'attachment; filename="transactions-report.csv"',
      );

      const csvLines = res.text.trim().split("\n");
      expect(csvLines[0]).toBe(
        "ID,Date,Customer,Worker,Fuel,Litres,Amount,DiscountPercent,Discount",
      );
      expect(csvLines.length).toBeGreaterThan(1);
      expect(res.text).toContain("Rahul Sharma");
      expect(res.text).toContain("Worker Amit");
    });

    it("exports customers CSV stream with correct headers", async () => {
      const res = await request(app)
        .get("/api/v1/admin/reports/export?category=customers")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.header["content-type"]).toContain("text/csv");
      const csvLines = res.text.trim().split("\n");
      expect(csvLines[0]).toBe("ID,Name,Phone,Group,Registered,Transactions,Discount");
      expect(res.text).toContain("Rahul Sharma");
      expect(res.text).toContain("Anjali Verma");
    });

    it("exports workers CSV stream with correct headers", async () => {
      const res = await request(app)
        .get("/api/v1/admin/reports/export?category=workers")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.header["content-type"]).toContain("text/csv");
      const csvLines = res.text.trim().split("\n");
      expect(csvLines[0]).toBe("ID,Name,Status,Scans,Transactions,DiscountProcessed,LastActivity");
      expect(res.text).toContain("Worker Amit");
      expect(res.text).toContain("Worker Priya");
    });
  });

  // ============================================================================
  // 7. Global Search
  // ============================================================================
  describe("GET /api/v1/admin/search", () => {
    it("returns 422 when query parameter q is missing", async () => {
      const res = await request(app)
        .get("/api/v1/admin/search")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("finds matching customers and workers by query string", async () => {
      const res = await request(app)
        .get("/api/v1/admin/search?q=Rahul")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.customers).toHaveLength(1);
      expect(res.body.customers[0].name).toBe("Rahul Sharma");
      expect(res.body.workers).toHaveLength(0);
    });

    it("finds workers by name", async () => {
      const res = await request(app)
        .get("/api/v1/admin/search?q=Amit")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.workers).toHaveLength(1);
      expect(res.body.workers[0].name).toBe("Worker Amit");
    });

    it("finds entities by partial phone number", async () => {
      const res = await request(app)
        .get("/api/v1/admin/search?q=98333")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.customers).toHaveLength(1);
      expect(res.body.customers[0].phone).toBe("+919833333333");
    });
  });

  // ============================================================================
  // 8. Notifications Management
  // ============================================================================
  describe("Notifications Management", () => {
    it("GET /api/v1/admin/notifications lists notifications with unreadCount", async () => {
      const res = await request(app)
        .get("/api/v1/admin/notifications")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(3);
      expect(res.body.unreadCount).toBe(2);
      expect(res.body.pagination.total).toBe(3);
    });

    it("PATCH /api/v1/admin/notifications/:id/read marks single notification as read", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/notifications/${notif1Id}/read`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.notification.isRead).toBe(true);

      // Verify unreadCount decremented
      const checkRes = await request(app)
        .get("/api/v1/admin/notifications")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(checkRes.body.unreadCount).toBe(1);
    });

    it("POST /api/v1/admin/notifications/mark-all-read marks all as read", async () => {
      const res = await request(app)
        .post("/api/v1/admin/notifications/mark-all-read")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("All notifications marked as read");

      // Verify unreadCount is 0
      const checkRes = await request(app)
        .get("/api/v1/admin/notifications")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(checkRes.body.unreadCount).toBe(0);
    });

    it("returns 404 for non-existent notification ID", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/notifications/${crypto.randomUUID()}/read`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOTIFICATION_NOT_FOUND");
    });
  });

  // ============================================================================
  // 9. Audit Logs View
  // ============================================================================
  describe("GET /api/v1/admin/audit-logs", () => {
    it("lists all audit logs with pagination", async () => {
      const res = await request(app)
        .get("/api/v1/admin/audit-logs")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.total).toBe(2);
    });

    it("filters audit logs by action", async () => {
      const res = await request(app)
        .get("/api/v1/admin/audit-logs?action=scan.rejected")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].action).toBe("scan.rejected");
      expect(res.body.data[0].reason).toBe("CUSTOMER_INACTIVE");
    });

    it("filters audit logs by actorType", async () => {
      const res = await request(app)
        .get("/api/v1/admin/audit-logs?actorType=admin")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].actorType).toBe("admin");
      expect(res.body.data[0].action).toBe("customer.created");
    });

    it("filters audit logs by entityType", async () => {
      const res = await request(app)
        .get("/api/v1/admin/audit-logs?entityType=customer")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].entityType).toBe("customer");
    });
  });

  // ============================================================================
  // 10. Background Cleanup Job
  // ============================================================================
  describe("Cleanup Job (cleanupExpiredRecords)", () => {
    it("prunes expired OTPs, refresh tokens and reset tokens but leaves notifications intact", async () => {
      // 1. Insert expired OTP and valid OTP
      await testPool.query(
        `INSERT INTO otp_codes (channel, destination, code_hash, purpose, expires_at)
         VALUES ('sms', '+919999999901', 'hash1', 'login', now() - interval '15 minutes')`,
      );
      await testPool.query(
        `INSERT INTO otp_codes (channel, destination, code_hash, purpose, expires_at)
         VALUES ('sms', '+919999999902', 'hash2', 'login', now() + interval '5 minutes')`,
      );

      // 2. Insert expired refresh token and valid refresh token
      await testPool.query(
        `INSERT INTO refresh_tokens (token_hash, admin_user_id, expires_at)
         VALUES ('rf_hash_expired', $1, now() - interval '1 day')`,
        [adminId],
      );
      await testPool.query(
        `INSERT INTO refresh_tokens (token_hash, admin_user_id, expires_at)
         VALUES ('rf_hash_valid', $1, now() + interval '7 days')`,
        [adminId],
      );

      // 3. Insert expired reset token and valid reset token
      await testPool.query(
        `INSERT INTO admin_password_reset_tokens (admin_user_id, token_hash, expires_at)
         VALUES ($1, 'reset_hash_expired', now() - interval '1 hour')`,
        [adminId],
      );
      await testPool.query(
        `INSERT INTO admin_password_reset_tokens (admin_user_id, token_hash, expires_at)
         VALUES ($1, 'reset_hash_valid', now() + interval '1 hour')`,
        [adminId],
      );

      // Verify count before cleanup
      const notifCountBefore = (await testPool.query(`SELECT COUNT(*) FROM notifications`)).rows[0]
        .count;

      // Execute cleanup
      const result = await cleanupExpiredRecords(testPool);

      expect(result.expiredOtpsDeleted).toBe(1);
      expect(result.expiredRefreshTokensDeleted).toBe(1);
      expect(result.expiredResetTokensDeleted).toBe(1);

      // Verify valid records still exist
      const validOtps = await testPool.query(`SELECT COUNT(*) FROM otp_codes`);
      expect(Number(validOtps.rows[0].count)).toBe(1);

      const validTokens = await testPool.query(`SELECT COUNT(*) FROM refresh_tokens`);
      expect(Number(validTokens.rows[0].count)).toBe(1);

      const validResets = await testPool.query(`SELECT COUNT(*) FROM admin_password_reset_tokens`);
      expect(Number(validResets.rows[0].count)).toBe(1);

      // Notifications must NEVER be pruned
      const notifCountAfter = (await testPool.query(`SELECT COUNT(*) FROM notifications`)).rows[0]
        .count;
      expect(notifCountAfter).toBe(notifCountBefore);
    });
  });
});
