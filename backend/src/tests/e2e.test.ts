import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { app } from "../app.js";
import { testPool, ensureTestDatabaseMigrated, truncateAllTables } from "./test-db.js";
import { hashPassword } from "../common/utils/crypto.js";
import { seedDefaultGroup } from "../seeds/default-group.seed.js";
import { smsSender } from "../integrations/sms/index.js";

describe("E2E Main Flow Test", () => {
  let adminToken: string;
  let fleetGroupId: string;
  let _adminCustomerId: string;
  let workerId: string;
  let workerToken: string;
  let registeredCustomerId: string;
  let customerQrToken: string;
  let scanTicket: string;
  const successTxId = crypto.randomUUID();
  const failedTxId = crypto.randomUUID();

  beforeAll(async () => {
    await ensureTestDatabaseMigrated();
    await truncateAllTables();
    await seedDefaultGroup(testPool);
    smsSender.clearHistory();

    // Seed initial Super Admin
    const passwordHash = await hashPassword("AdminPass123!");
    await testPool.query(
      `INSERT INTO admin_users (name, email, phone, password_hash, role, location, initials, is_active)
       VALUES ('Super Admin', 'admin@fuelpoint.local', '+919999999999', $1, 'Super Admin', 'Main HQ', 'SA', TRUE)`,
      [passwordHash],
    );
  });

  afterAll(async () => {
    await testPool.end();
  });

  // Step 1: Admin signs in
  it("Step 1: Admin signs in", async () => {
    const res = await request(app)
      .post("/api/v1/auth/admin/login")
      .send({ email: "admin@fuelpoint.local", password: "AdminPass123!" });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.admin).toBeDefined();
    expect(res.body.admin.role).toBe("Super Admin");

    // Verify httpOnly refresh cookie is issued
    const rawCookies = res.headers["set-cookie"];
    const cookieHeader = Array.isArray(rawCookies) ? rawCookies : [String(rawCookies)];
    expect(cookieHeader.some((c) => c.includes("fuelpoint_refresh_token="))).toBe(true);

    adminToken = res.body.accessToken;
  });

  // Step 2: Admin creates a group, a customer, and a worker
  it("Step 2: Admin creates a group, a customer, and a worker", async () => {
    // 2a. Create Group
    const groupRes = await request(app)
      .post("/api/v1/admin/groups")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Fleet Gold",
        discountPercent: 8.5,
        description: "Special fleet discount group",
      });

    expect(groupRes.status).toBe(201);
    expect(groupRes.body.group.name).toBe("Fleet Gold");
    expect(Number(groupRes.body.group.discountPercent)).toBe(8.5);
    fleetGroupId = groupRes.body.group.id;

    // 2b. Create Customer
    const custRes = await request(app)
      .post("/api/v1/admin/customers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Vijay M",
        phone: "+919811122233",
        email: "vijay@example.com",
        vehicle: "MH12AB1234",
        groupId: fleetGroupId,
      });

    expect(custRes.status).toBe(201);
    expect(custRes.body.customer.name).toBe("Vijay M");
    expect(custRes.body.customer.phone).toBe("+919811122233");
    expect(custRes.body.customer.groupId).toBe(fleetGroupId);
    _adminCustomerId = custRes.body.customer.id;

    // 2c. Create Worker
    const workerRes = await request(app)
      .post("/api/v1/admin/workers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Attendant Amit",
        phone: "+919822334455",
        email: "amit@fuelpoint.local",
        shift: "Morning",
        status: "active",
      });

    expect(workerRes.status).toBe(201);
    expect(workerRes.body.worker.name).toBe("Attendant Amit");
    expect(workerRes.body.worker.phone).toBe("+919822334455");
    expect(workerRes.body.worker.status).toBe("active");
    workerId = workerRes.body.worker.id;
  });

  // Step 3: Customer registers by OTP
  it("Step 3: Customer registers by OTP", async () => {
    // Request registration OTP
    const reqOtpRes = await request(app).post("/api/v1/auth/otp/request").send({
      destination: "+919833445566",
      purpose: "register",
      channel: "sms",
    });

    expect(reqOtpRes.status).toBe(200);
    expect(reqOtpRes.body.message).toBe("Code sent");

    // Get code from simulated dev SMS sender
    const sentOtp = smsSender.getLastSent("+919833445566");
    expect(sentOtp).toBeDefined();
    expect(sentOtp?.code).toHaveLength(6);

    // Complete customer self-registration
    const regRes = await request(app).post("/api/v1/customer/register").send({
      phone: "+919833445566",
      name: "Rahul Dravid",
      code: sentOtp!.code,
    });

    expect(regRes.status).toBe(201);
    expect(regRes.body.accessToken).toBeDefined();
    expect(regRes.body.customer.name).toBe("Rahul Dravid");
    expect(regRes.body.customer.phone).toBe("+919833445566");
    expect(regRes.body.customer.qrToken).toBeDefined();

    registeredCustomerId = regRes.body.customer.id;
    customerQrToken = regRes.body.customer.qrToken;

    // Assign registered customer to Fleet Gold group
    const assignRes = await request(app)
      .patch(`/api/v1/admin/customers/${registeredCustomerId}/group`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ groupId: fleetGroupId });

    expect(assignRes.status).toBe(200);
    expect(assignRes.body.customer.groupId).toBe(fleetGroupId);
  });

  // Step 4: Worker logs in
  it("Step 4: Worker logs in via OTP", async () => {
    // Request worker login OTP
    const reqOtpRes = await request(app).post("/api/v1/auth/otp/request").send({
      destination: "+919822334455",
      purpose: "login",
      channel: "sms",
      actor_type: "worker",
    });

    expect(reqOtpRes.status).toBe(200);
    const sentOtp = smsSender.getLastSent("+919822334455");
    expect(sentOtp).toBeDefined();

    // Verify worker login OTP
    const verifyRes = await request(app).post("/api/v1/auth/otp/verify").send({
      destination: "+919822334455",
      code: sentOtp!.code,
      actor_type: "worker",
    });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.accessToken).toBeDefined();
    expect(verifyRes.body.actor.role).toBe("worker");
    expect(verifyRes.body.actor.name).toBe("Attendant Amit");

    workerToken = verifyRes.body.accessToken;
  });

  // Step 5: Worker scans customer QR
  it("Step 5: Worker scans customer QR", async () => {
    const scanRes = await request(app)
      .post("/api/v1/worker/scan")
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ qrToken: customerQrToken });

    expect(scanRes.status).toBe(200);
    expect(scanRes.body.customerId).toBe(registeredCustomerId);
    expect(scanRes.body.customerName).toBe("Rahul Dravid");
    expect(scanRes.body.groupId).toBe(fleetGroupId);
    expect(scanRes.body.groupName).toBe("Fleet Gold");
    expect(scanRes.body.discountPercent).toBe("8.50");
    expect(scanRes.body.scanTicket).toBeDefined();

    scanTicket = scanRes.body.scanTicket;
  });

  // Step 6: Worker submits transaction
  it("Step 6: Worker submits transaction", async () => {
    // 6a. Submit first transaction
    const txRes = await request(app)
      .post("/api/v1/worker/transactions")
      .set("Authorization", `Bearer ${workerToken}`)
      .send({
        id: successTxId,
        scanTicket,
        amount: "1000.00",
        litres: "10.00",
        fuelType: "Petrol",
      });

    expect(txRes.status).toBe(201);
    expect(txRes.body.id).toBe(successTxId);
    expect(txRes.body.status).toBe("pending");
    expect(txRes.body.amount).toBe("1000.00");
    expect(txRes.body.discountPercent).toBe("8.50");
    expect(txRes.body.discountAmount).toBe("85.00");
    expect(txRes.body.netPayable).toBe("915.00");
    expect(txRes.body.fuel).toBe("Petrol");
    expect(txRes.body.litres).toBe("10.00");
    expect(txRes.body.resolvedAt).toBeNull();

    // 6b. Scan again for a second transaction
    const scanRes2 = await request(app)
      .post("/api/v1/worker/scan")
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ qrToken: customerQrToken });

    expect(scanRes2.status).toBe(200);
    const scanTicket2 = scanRes2.body.scanTicket;

    const txRes2 = await request(app)
      .post("/api/v1/worker/transactions")
      .set("Authorization", `Bearer ${workerToken}`)
      .send({
        id: failedTxId,
        scanTicket: scanTicket2,
        amount: "500.00",
        litres: "5.00",
        fuelType: "Diesel",
      });

    expect(txRes2.status).toBe(201);
    expect(txRes2.body.id).toBe(failedTxId);
  });

  // Step 7: Worker marks transaction success
  it("Step 7: Worker marks transaction success", async () => {
    const updateRes = await request(app)
      .patch(`/api/v1/worker/transactions/${successTxId}/status`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ status: "success" });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.id).toBe(successTxId);
    expect(updateRes.body.status).toBe("success");
    expect(updateRes.body.resolvedAt).not.toBeNull();

    const updateRes2 = await request(app)
      .patch(`/api/v1/worker/transactions/${failedTxId}/status`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ status: "success" });

    expect(updateRes2.status).toBe(200);
  });

  // Step 8: Admin changes result to failed
  it("Step 8: Admin changes transaction status to failed", async () => {
    const adminUpdateRes = await request(app)
      .patch(`/api/v1/admin/transactions/${failedTxId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "failed",
        failureReason: "Card payment declined at dispenser",
      });

    expect(adminUpdateRes.status).toBe(200);
    expect(adminUpdateRes.body.transaction.id).toBe(failedTxId);
    expect(adminUpdateRes.body.transaction.status).toBe("failed");
    expect(adminUpdateRes.body.transaction.failureReason).toBe(
      "Card payment declined at dispenser",
    );
  });

  // Step 9: Verify dashboard, reports, audit logs, notifications and CSV
  it("Step 9a: Verify dashboard overview and series", async () => {
    const overviewRes = await request(app)
      .get("/api/v1/admin/dashboard/overview")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.totalCustomers).toBeGreaterThanOrEqual(2);
    expect(overviewRes.body.totalWorkers).toBeGreaterThanOrEqual(1);
    expect(overviewRes.body.totalGroups).toBeGreaterThanOrEqual(2);
    expect(overviewRes.body.totalTransactions).toBeGreaterThanOrEqual(1);

    const seriesRes = await request(app)
      .get("/api/v1/admin/dashboard/series?days=7")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(seriesRes.status).toBe(200);
    expect(seriesRes.body.series).toHaveLength(7);

    const workerActivityRes = await request(app)
      .get("/api/v1/admin/dashboard/worker-activity")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(workerActivityRes.status).toBe(200);
    const workerStats = workerActivityRes.body.workers.find(
      (w: { id: string }) => w.id === workerId,
    );
    expect(workerStats).toBeDefined();
    expect(workerStats.scans).toBeGreaterThanOrEqual(1);

    const groupDistRes = await request(app)
      .get("/api/v1/admin/dashboard/group-distribution")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(groupDistRes.status).toBe(200);
    const goldGroup = groupDistRes.body.groups.find((g: { id: string }) => g.id === fleetGroupId);
    expect(goldGroup).toBeDefined();
    expect(goldGroup.customers).toBeGreaterThanOrEqual(2);
  });

  it("Step 9b: Verify reports summary", async () => {
    const reportRes = await request(app)
      .get("/api/v1/admin/reports/summary?category=transactions")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(reportRes.status).toBe(200);
    expect(reportRes.body.category).toBe("transactions");
    expect(reportRes.body.range).toBeDefined();
    expect(reportRes.body.metrics).toBeInstanceOf(Array);
    expect(reportRes.body.series).toBeInstanceOf(Array);
  });

  it("Step 9c: Verify audit logs", async () => {
    const auditRes = await request(app)
      .get("/api/v1/admin/audit-logs")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(auditRes.status).toBe(200);
    const actions = auditRes.body.data.map((a: { action: string }) => a.action);

    expect(actions).toContain("customer.created");
    expect(actions).toContain("worker.created");
    expect(actions).toContain("group.created");
    expect(actions).toContain("transaction.created");
    expect(actions).toContain("transaction.status_changed");

    // Verify the status_changed audit entry captures failure reason
    const failureLog = auditRes.body.data.find(
      (a: { action: string; newStatus: string }) =>
        a.action === "transaction.status_changed" && a.newStatus === "failed",
    );
    expect(failureLog).toBeDefined();
    expect(failureLog.reason).toBe("Card payment declined at dispenser");
    expect(failureLog.actorType).toBe("admin");
  });

  it("Step 9d: Verify notifications", async () => {
    const notifRes = await request(app)
      .get("/api/v1/admin/notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(notifRes.status).toBe(200);
    const notifications = notifRes.body.notifications;

    // Verify customer registration notification
    const regNotif = notifications.find(
      (n: { type: string; customerId?: string }) =>
        n.type === "registration" && n.customerId === registeredCustomerId,
    );
    expect(regNotif).toBeDefined();
    expect(regNotif.title).toBe("New Customer Registered");

    // Verify worker first-login notification
    const workerNotif = notifications.find(
      (n: { type: string; workerId?: string }) => n.type === "worker" && n.workerId === workerId,
    );
    expect(workerNotif).toBeDefined();
    expect(workerNotif.title).toBe("Worker First Login");
  });

  it("Step 9e: Verify CSV export", async () => {
    const csvRes = await request(app)
      .get("/api/v1/admin/reports/export?category=transactions&format=csv")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(csvRes.status).toBe(200);
    expect(csvRes.headers["content-type"]).toContain("text/csv");
    expect(csvRes.text).toContain(
      "ID,Date,Customer,Worker,Fuel,Litres,Amount,DiscountPercent,Discount",
    );
    expect(csvRes.text).toContain(successTxId);
    expect(csvRes.text).toContain("1000.00");
    expect(csvRes.text).toContain("8.50");
    expect(csvRes.text).toContain("85.00");
  });
});
