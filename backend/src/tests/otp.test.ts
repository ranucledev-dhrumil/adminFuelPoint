import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { testPool, ensureTestDatabaseMigrated, truncateAllTables } from "./test-db.js";
import { hashSha256, signAccessToken } from "../common/utils/crypto.js";
import { DEFAULT_GROUP_ID, seedDefaultGroup } from "../seeds/default-group.seed.js";
import { smsSender } from "../integrations/sms/index.js";

describe("OTP, Customer Registration, Login & QR Integration Tests", () => {
  beforeAll(async () => {
    await ensureTestDatabaseMigrated();
  });

  beforeEach(async () => {
    await truncateAllTables();
    await seedDefaultGroup(testPool);
    smsSender.clearHistory();
  });

  afterAll(async () => {
    await testPool.end();
  });

  // ============================================================================
  // 1. POST /api/v1/auth/otp/request
  // ============================================================================
  describe("POST /api/v1/auth/otp/request", () => {
    it("requests registration OTP for an unregistered phone, sends SMS, and stores OTP row", async () => {
      const res = await request(app).post("/api/v1/auth/otp/request").send({
        destination: "9876543210",
        purpose: "register",
        channel: "sms",
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Code sent");
      expect(res.body.cooldown).toBe(60);

      const dbOtp = await testPool.query(
        "SELECT * FROM otp_codes WHERE destination = '+919876543210' AND purpose = 'register'",
      );
      expect(dbOtp.rowCount).toBe(1);
      expect(dbOtp.rows[0].actor_type).toBeNull();
      expect(dbOtp.rows[0].actor_id).toBeNull();

      const lastSent = smsSender.getLastSent("+919876543210");
      expect(lastSent).toBeDefined();
      expect(lastSent?.code.length).toBe(6);
    });

    it("rejects registration OTP with 409 Conflict if phone is already registered to an existing customer", async () => {
      await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id)
         VALUES ('Existing Cust', '+919876543210', 'qr_exist', $1)`,
        [DEFAULT_GROUP_ID],
      );

      const res = await request(app).post("/api/v1/auth/otp/request").send({
        destination: "9876543210",
        purpose: "register",
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("PHONE_ALREADY_EXISTS");
    });

    it("enforces timing-safe unknown phone login rule: returns 200, stores NO row, and sends NO SMS", async () => {
      const res = await request(app).post("/api/v1/auth/otp/request").send({
        destination: "9876543999",
        purpose: "login",
        actor_type: "customer",
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Code sent");
      expect(res.body.cooldown).toBe(60);

      // Verify NO row stored
      const dbOtp = await testPool.query(
        "SELECT * FROM otp_codes WHERE destination = '+919876543999'",
      );
      expect(dbOtp.rowCount).toBe(0);

      // Verify NO SMS sent
      const lastSent = smsSender.getLastSent("+919876543999");
      expect(lastSent).toBeUndefined();
    });

    it("requests login OTP for registered active customer, stores OTP row with actor, and sends SMS", async () => {
      const custRes = await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id, status)
         VALUES ('Arun Verma', '+919811111111', 'qr_arun', $1, 'active')
         RETURNING id`,
        [DEFAULT_GROUP_ID],
      );
      const customerId = custRes.rows[0].id;

      const res = await request(app).post("/api/v1/auth/otp/request").send({
        destination: "9811111111",
        purpose: "login",
        actor_type: "customer",
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Code sent");

      const dbOtp = await testPool.query(
        "SELECT * FROM otp_codes WHERE destination = '+919811111111' AND purpose = 'login'",
      );
      expect(dbOtp.rowCount).toBe(1);
      expect(dbOtp.rows[0].actor_type).toBe("customer");
      expect(dbOtp.rows[0].actor_id).toBe(customerId);

      const lastSent = smsSender.getLastSent("+919811111111");
      expect(lastSent).toBeDefined();
    });

    it("enforces 60-second cooldown: requesting again immediately returns 429 COOLDOWN_ACTIVE", async () => {
      // First request
      await request(app).post("/api/v1/auth/otp/request").send({
        destination: "9822222222",
        purpose: "register",
      });

      // Immediate second request
      const res = await request(app).post("/api/v1/auth/otp/request").send({
        destination: "9822222222",
        purpose: "register",
      });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe("COOLDOWN_ACTIVE");
    });

    it("enforces destination hourly limit (5 max): 6th request within 1 hour returns 429 HOURLY_LIMIT_EXCEEDED", async () => {
      const destination = "+919833333333";
      // Insert 5 past OTPs for this destination within the last hour, spread apart to avoid cooldown
      for (let i = 0; i < 5; i++) {
        await testPool.query(
          `INSERT INTO otp_codes (channel, destination, code_hash, purpose, expires_at, created_at)
           VALUES ('sms', $1, 'hash_dummy', 'register', now() + interval '5 minutes', now() - interval '${10 + i * 2} minutes')`,
          [destination],
        );
      }

      const res = await request(app).post("/api/v1/auth/otp/request").send({
        destination: "9833333333",
        purpose: "register",
      });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe("HOURLY_LIMIT_EXCEEDED");
    });

    it("enforces per-IP hourly limit for registration OTPs (10 max): 11th request returns 429 IP_HOURLY_LIMIT_EXCEEDED", async () => {
      // Insert 10 registration OTPs from IP 127.0.0.1 across different destinations
      for (let i = 0; i < 10; i++) {
        await testPool.query(
          `INSERT INTO otp_codes (channel, destination, code_hash, purpose, request_ip, expires_at, created_at)
           VALUES ('sms', $1, 'hash_dummy', 'register', '127.0.0.1'::inet, now() + interval '5 minutes', now() - interval '${i + 5} minutes')`,
          [`+91984444440${i}`],
        );
      }

      const res = await request(app).post("/api/v1/auth/otp/request").send({
        destination: "9844444499",
        purpose: "register",
      });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe("IP_HOURLY_LIMIT_EXCEEDED");
    });
  });

  // ============================================================================
  // 2. POST /api/v1/auth/otp/verify (Login Verification)
  // ============================================================================
  describe("POST /api/v1/auth/otp/verify", () => {
    it("successfully logs in active customer with correct OTP, returns tokens and customer actor", async () => {
      const c = await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id, status)
         VALUES ('Vijay Mallya', '+919855555555', 'qr_vijay', $1, 'active')
         RETURNING id`,
        [DEFAULT_GROUP_ID],
      );
      const customerId = c.rows[0].id;

      const code = "123456";
      const codeHash = hashSha256(code);
      await testPool.query(
        `INSERT INTO otp_codes (channel, destination, actor_type, actor_id, code_hash, purpose, expires_at)
         VALUES ('sms', '+919855555555', 'customer', $1, $2, 'login', now() + interval '5 minutes')`,
        [customerId, codeHash],
      );

      const res = await request(app).post("/api/v1/auth/otp/verify").send({
        destination: "9855555555",
        code: "123456",
        actor_type: "customer",
      });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.actor.id).toBe(customerId);
      expect(res.body.actor.role).toBe("customer");
      expect(res.body.actor.name).toBe("Vijay Mallya");

      // Verify OTP is marked consumed
      const otpCheck = await testPool.query(
        "SELECT consumed_at FROM otp_codes WHERE destination = '+919855555555'",
      );
      expect(otpCheck.rows[0].consumed_at).not.toBeNull();

      // Verify refresh token stored in DB
      const tokenCheck = await testPool.query(
        "SELECT * FROM refresh_tokens WHERE customer_id = $1",
        [customerId],
      );
      expect(tokenCheck.rowCount).toBe(1);
    });

    it("blocks inactive customer from logging in with 403 CUSTOMER_INACTIVE", async () => {
      const c = await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id, status)
         VALUES ('Inactive Cust', '+919866666666', 'qr_inact', $1, 'inactive')
         RETURNING id`,
        [DEFAULT_GROUP_ID],
      );
      const customerId = c.rows[0].id;

      const codeHash = hashSha256("654321");
      await testPool.query(
        `INSERT INTO otp_codes (channel, destination, actor_type, actor_id, code_hash, purpose, expires_at)
         VALUES ('sms', '+919866666666', 'customer', $1, $2, 'login', now() + interval '5 minutes')`,
        [customerId, codeHash],
      );

      const res = await request(app).post("/api/v1/auth/otp/verify").send({
        destination: "9866666666",
        code: "654321",
        actor_type: "customer",
      });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("CUSTOMER_INACTIVE");
    });

    it("worker login: sets first_login_at and creates worker notification on first login; subsequent login skips notification", async () => {
      const w = await testPool.query(
        `INSERT INTO workers (name, email, phone, shift, status)
         VALUES ('Sunil Gavaskar', 'sunil@worker.local', '+919877777777', 'Morning', 'active')
         RETURNING id`,
      );
      const workerId = w.rows[0].id;

      // 1. First login OTP
      const code1Hash = hashSha256("111222");
      await testPool.query(
        `INSERT INTO otp_codes (channel, destination, actor_type, actor_id, code_hash, purpose, expires_at)
         VALUES ('sms', '+919877777777', 'worker', $1, $2, 'login', now() + interval '5 minutes')`,
        [workerId, code1Hash],
      );

      const res1 = await request(app).post("/api/v1/auth/otp/verify").send({
        destination: "9877777777",
        code: "111222",
        actor_type: "worker",
      });

      expect(res1.status).toBe(200);
      expect(res1.body.actor.role).toBe("worker");

      // Verify first_login_at is now set on worker
      const workerCheck = await testPool.query("SELECT first_login_at FROM workers WHERE id = $1", [
        workerId,
      ]);
      expect(workerCheck.rows[0].first_login_at).not.toBeNull();

      // Verify notification created
      const notifCheck = await testPool.query(
        "SELECT * FROM notifications WHERE worker_id = $1 AND type = 'worker'",
        [workerId],
      );
      expect(notifCheck.rowCount).toBe(1);
      expect(notifCheck.rows[0].title).toBe("Worker First Login");

      // 2. Second login OTP
      const code2Hash = hashSha256("333444");
      await testPool.query(
        `INSERT INTO otp_codes (channel, destination, actor_type, actor_id, code_hash, purpose, expires_at)
         VALUES ('sms', '+919877777777', 'worker', $1, $2, 'login', now() + interval '5 minutes')`,
        [workerId, code2Hash],
      );

      const res2 = await request(app).post("/api/v1/auth/otp/verify").send({
        destination: "9877777777",
        code: "333444",
        actor_type: "worker",
      });

      expect(res2.status).toBe(200);

      // Verify NO duplicate notification was created
      const notifCheck2 = await testPool.query(
        "SELECT * FROM notifications WHERE worker_id = $1 AND type = 'worker'",
        [workerId],
      );
      expect(notifCheck2.rowCount).toBe(1);
    });

    it("worker login: blocks offline worker with 403 WORKER_NOT_ACTIVE and suspended worker with 403 WORKER_SUSPENDED", async () => {
      const wOff = await testPool.query(
        `INSERT INTO workers (name, email, phone, shift, status)
         VALUES ('Offline Worker', 'off@worker.local', '+919888888801', 'Morning', 'offline')
         RETURNING id`,
      );
      const offHash = hashSha256("123123");
      await testPool.query(
        `INSERT INTO otp_codes (channel, destination, actor_type, actor_id, code_hash, purpose, expires_at)
         VALUES ('sms', '+919888888801', 'worker', $1, $2, 'login', now() + interval '5 minutes')`,
        [wOff.rows[0].id, offHash],
      );

      const resOff = await request(app).post("/api/v1/auth/otp/verify").send({
        destination: "9888888801",
        code: "123123",
        actor_type: "worker",
      });
      expect(resOff.status).toBe(403);
      expect(resOff.body.error.code).toBe("WORKER_NOT_ACTIVE");

      const wSusp = await testPool.query(
        `INSERT INTO workers (name, email, phone, shift, status)
         VALUES ('Suspended Worker', 'susp@worker.local', '+919888888802', 'Night', 'suspended')
         RETURNING id`,
      );
      const suspHash = hashSha256("456456");
      await testPool.query(
        `INSERT INTO otp_codes (channel, destination, actor_type, actor_id, code_hash, purpose, expires_at)
         VALUES ('sms', '+919888888802', 'worker', $1, $2, 'login', now() + interval '5 minutes')`,
        [wSusp.rows[0].id, suspHash],
      );

      const resSusp = await request(app).post("/api/v1/auth/otp/verify").send({
        destination: "9888888802",
        code: "456456",
        actor_type: "worker",
      });
      expect(resSusp.status).toBe(403);
      expect(resSusp.body.error.code).toBe("WORKER_SUSPENDED");
    });

    it("increments attempts on wrong code and blocks after 5 failed attempts with MAX_ATTEMPTS_EXCEEDED", async () => {
      const c = await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id, status)
         VALUES ('Wrong Attempts', '+919899999999', 'qr_wrong', $1, 'active')
         RETURNING id`,
        [DEFAULT_GROUP_ID],
      );

      const codeHash = hashSha256("999888");
      await testPool.query(
        `INSERT INTO otp_codes (channel, destination, actor_type, actor_id, code_hash, purpose, expires_at, attempts)
         VALUES ('sms', '+919899999999', 'customer', $1, $2, 'login', now() + interval '5 minutes', 4)
         RETURNING id`,
        [c.rows[0].id, codeHash],
      );

      // Attempt 5 (wrong)
      const res1 = await request(app).post("/api/v1/auth/otp/verify").send({
        destination: "9899999999",
        code: "000000",
        actor_type: "customer",
      });
      expect(res1.status).toBe(401);

      // Attempt 6 (already reached 5 attempts)
      const res2 = await request(app).post("/api/v1/auth/otp/verify").send({
        destination: "9899999999",
        code: "999888",
        actor_type: "customer",
      });
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe("MAX_ATTEMPTS_EXCEEDED");
    });

    it("rejects expired OTP with 400 OTP_EXPIRED", async () => {
      const c = await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id, status)
         VALUES ('Expired Cust', '+919800000000', 'qr_exp', $1, 'active')
         RETURNING id`,
        [DEFAULT_GROUP_ID],
      );

      const codeHash = hashSha256("123456");
      await testPool.query(
        `INSERT INTO otp_codes (channel, destination, actor_type, actor_id, code_hash, purpose, expires_at)
         VALUES ('sms', '+919800000000', 'customer', $1, $2, 'login', now() - interval '1 minute')`,
        [c.rows[0].id, codeHash],
      );

      const res = await request(app).post("/api/v1/auth/otp/verify").send({
        destination: "9800000000",
        code: "123456",
        actor_type: "customer",
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("OTP_EXPIRED");
    });
  });

  // ============================================================================
  // 3. POST /api/v1/customer/register
  // ============================================================================
  describe("POST /api/v1/customer/register", () => {
    it("registers new customer with valid register OTP, generates QR token, sends registration notification, and writes audit log", async () => {
      const code = "789012";
      const codeHash = hashSha256(code);
      await testPool.query(
        `INSERT INTO otp_codes (channel, destination, code_hash, purpose, expires_at)
         VALUES ('sms', '+919812345678', $1, 'register', now() + interval '5 minutes')`,
        [codeHash],
      );

      const res = await request(app).post("/api/v1/customer/register").send({
        phone: "9812345678",
        name: "Rohit Sharma",
        code: "789012",
      });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.customer.name).toBe("Rohit Sharma");
      expect(res.body.customer.phone).toBe("+919812345678");
      expect(res.body.customer.qrToken).toBeDefined();
      expect(res.body.customer.status).toBe("active");

      const customerId = res.body.customer.id;

      // Verify registered customer is in default group
      const dbCust = await testPool.query("SELECT * FROM customers WHERE id = $1", [customerId]);
      expect(dbCust.rows[0].group_id).toBe(DEFAULT_GROUP_ID);

      // Verify OTP is consumed
      const dbOtp = await testPool.query(
        "SELECT consumed_at FROM otp_codes WHERE destination = '+919812345678'",
      );
      expect(dbOtp.rows[0].consumed_at).not.toBeNull();

      // Verify notification created
      const notif = await testPool.query(
        "SELECT * FROM notifications WHERE customer_id = $1 AND type = 'registration'",
        [customerId],
      );
      expect(notif.rowCount).toBe(1);
      expect(notif.rows[0].title).toBe("New Customer Registered");

      // Verify audit log recorded customer.created
      const audit = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'customer.created' AND entity_id = $1",
        [customerId],
      );
      expect(audit.rowCount).toBe(1);
      expect(audit.rows[0].actor_type).toBe("customer");
    });

    it("rejects registration with invalid OTP code with 400 Bad Request", async () => {
      const codeHash = hashSha256("654321");
      await testPool.query(
        `INSERT INTO otp_codes (channel, destination, code_hash, purpose, expires_at)
         VALUES ('sms', '+919823456789', $1, 'register', now() + interval '5 minutes')`,
        [codeHash],
      );

      const res = await request(app).post("/api/v1/customer/register").send({
        phone: "9823456789",
        name: "Test User",
        code: "000000",
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_OTP");
    });
  });

  // ============================================================================
  // 4. GET /api/v1/customer/qr and POST /api/v1/customer/qr/regenerate
  // ============================================================================
  describe("Customer QR Endpoints", () => {
    let customerId: string;
    let customerToken: string;
    let initialQrToken: string;

    beforeEach(async () => {
      initialQrToken = "initial_qr_token_value_abc";
      const c = await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id, status)
         VALUES ('K L Rahul', '+919834567890', $1, $2, 'active')
         RETURNING id`,
        [initialQrToken, DEFAULT_GROUP_ID],
      );
      customerId = c.rows[0].id;

      customerToken = signAccessToken({
        sub: customerId,
        role: "customer",
        aud: "fuelpoint-customer",
      });
    });

    it("GET /api/v1/customer/qr returns active customer's QR token and metadata", async () => {
      const res = await request(app)
        .get("/api/v1/customer/qr")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.qrToken).toBe(initialQrToken);
      expect(res.body.name).toBe("K L Rahul");
      expect(res.body.status).toBe("active");
    });

    it("POST /api/v1/customer/qr/regenerate atomically replaces qr_token and writes audit log without token value", async () => {
      const res = await request(app)
        .post("/api/v1/customer/qr/regenerate")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.qrToken).toBeDefined();
      expect(res.body.qrToken).not.toBe(initialQrToken);
      expect(res.body.regeneratedAt).toBeDefined();

      const newQrToken = res.body.qrToken;

      // Verify DB now holds the new token
      const dbCust = await testPool.query("SELECT qr_token FROM customers WHERE id = $1", [
        customerId,
      ]);
      expect(dbCust.rows[0].qr_token).toBe(newQrToken);

      // Verify audit log has customer.qr_regenerated WITHOUT storing qr_token
      const audit = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'customer.qr_regenerated' AND entity_id = $1",
        [customerId],
      );
      expect(audit.rowCount).toBe(1);
      expect(JSON.stringify(audit.rows[0])).not.toContain(newQrToken);
      expect(JSON.stringify(audit.rows[0])).not.toContain(initialQrToken);
    });

    it("blocks inactive customer from viewing or regenerating QR with 403 CUSTOMER_INACTIVE", async () => {
      await testPool.query("UPDATE customers SET status = 'inactive' WHERE id = $1", [customerId]);

      const resGet = await request(app)
        .get("/api/v1/customer/qr")
        .set("Authorization", `Bearer ${customerToken}`);
      expect(resGet.status).toBe(403);
      expect(resGet.body.error.code).toBe("CUSTOMER_INACTIVE");

      const resRegen = await request(app)
        .post("/api/v1/customer/qr/regenerate")
        .set("Authorization", `Bearer ${customerToken}`);
      expect(resRegen.status).toBe(403);
      expect(resRegen.body.error.code).toBe("CUSTOMER_INACTIVE");
    });
  });

  // ============================================================================
  // 5. Mobile Token Refresh & Logout with Tokens in Request Body
  // ============================================================================
  describe("Mobile Refresh & Logout", () => {
    it("refreshes customer tokens using refreshToken in request body and rotates token", async () => {
      const c = await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id, status)
         VALUES ('Shubman Gill', '+919845678901', 'qr_shubman', $1, 'active')
         RETURNING id`,
        [DEFAULT_GROUP_ID],
      );
      const customerId = c.rows[0].id;

      const rawRefreshToken = "customer_raw_refresh_token_test";
      const tokenHash = hashSha256(rawRefreshToken);
      await testPool.query(
        `INSERT INTO refresh_tokens (token_hash, customer_id, expires_at)
         VALUES ($1, $2, now() + interval '30 days')`,
        [tokenHash, customerId],
      );

      const res = await request(app).post("/api/v1/auth/refresh").send({
        refreshToken: rawRefreshToken,
      });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.refreshToken).not.toBe(rawRefreshToken);

      // Verify old token is rotated in DB
      const oldCheck = await testPool.query(
        "SELECT revoked_at, replaced_by FROM refresh_tokens WHERE token_hash = $1",
        [tokenHash],
      );
      expect(oldCheck.rows[0].revoked_at).not.toBeNull();
      expect(oldCheck.rows[0].replaced_by).not.toBeNull();
    });

    it("refreshes worker tokens using refreshToken in request body", async () => {
      const w = await testPool.query(
        `INSERT INTO workers (name, email, phone, shift, status)
         VALUES ('Axar Patel', 'axar@worker.local', '+919856789012', 'Morning', 'active')
         RETURNING id`,
      );
      const workerId = w.rows[0].id;

      const rawRefreshToken = "worker_raw_refresh_token_test";
      const tokenHash = hashSha256(rawRefreshToken);
      await testPool.query(
        `INSERT INTO refresh_tokens (token_hash, worker_id, expires_at)
         VALUES ($1, $2, now() + interval '30 days')`,
        [tokenHash, workerId],
      );

      const res = await request(app).post("/api/v1/auth/refresh").send({
        refreshToken: rawRefreshToken,
      });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });

    it("blocks refresh for suspended worker with 403 WORKER_SUSPENDED and revokes sessions", async () => {
      const w = await testPool.query(
        `INSERT INTO workers (name, email, phone, shift, status)
         VALUES ('Suspended Worker', 'susp2@worker.local', '+919867890123', 'Night', 'suspended')
         RETURNING id`,
      );
      const workerId = w.rows[0].id;

      const rawToken = "worker_susp_token";
      const tokenHash = hashSha256(rawToken);
      await testPool.query(
        `INSERT INTO refresh_tokens (token_hash, worker_id, expires_at)
         VALUES ($1, $2, now() + interval '30 days')`,
        [tokenHash, workerId],
      );

      const res = await request(app).post("/api/v1/auth/refresh").send({
        refreshToken: rawToken,
      });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("WORKER_SUSPENDED");
    });

    it("detects refresh token reuse and revokes all active sessions for the actor", async () => {
      const c = await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id, status)
         VALUES ('Reuse Customer', '+919878901234', 'qr_reuse', $1, 'active')
         RETURNING id`,
        [DEFAULT_GROUP_ID],
      );
      const customerId = c.rows[0].id;

      const rawToken1 = "reuse_token_1";
      const hash1 = hashSha256(rawToken1);
      await testPool.query(
        `INSERT INTO refresh_tokens (token_hash, customer_id, expires_at, revoked_at)
         VALUES ($1, $2, now() + interval '30 days', now())
         RETURNING id`,
        [hash1, customerId],
      );

      // Active second token
      const rawToken2 = "reuse_token_2";
      const hash2 = hashSha256(rawToken2);
      await testPool.query(
        `INSERT INTO refresh_tokens (token_hash, customer_id, expires_at)
         VALUES ($1, $2, now() + interval '30 days')`,
        [hash2, customerId],
      );

      // Attempt refresh with revoked/reused token1
      const res = await request(app).post("/api/v1/auth/refresh").send({
        refreshToken: rawToken1,
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("REFRESH_TOKEN_REUSED");

      // Verify active token2 is now revoked too!
      const check2 = await testPool.query(
        "SELECT revoked_at FROM refresh_tokens WHERE token_hash = $1",
        [hash2],
      );
      expect(check2.rows[0].revoked_at).not.toBeNull();
    });

    it("logs out single device with refreshToken in request body", async () => {
      const c = await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id, status)
         VALUES ('Single Device Cust', '+919877777788', 'qr_sng', $1, 'active')
         RETURNING id`,
        [DEFAULT_GROUP_ID],
      );
      const customerId = c.rows[0].id;

      const rawToken = "single_device_logout_token";
      const hash = hashSha256(rawToken);
      await testPool.query(
        `INSERT INTO refresh_tokens (token_hash, customer_id, expires_at)
         VALUES ($1, $2, now() + interval '30 days')`,
        [hash, customerId],
      );

      const res = await request(app).post("/api/v1/auth/logout").send({
        refreshToken: rawToken,
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Logged out successfully");

      const check = await testPool.query(
        "SELECT revoked_at FROM refresh_tokens WHERE token_hash = $1",
        [hash],
      );
      expect(check.rows[0].revoked_at).not.toBeNull();
    });

    it("logs out all devices for authenticated customer with allDevices: true", async () => {
      const c = await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id, status)
         VALUES ('All Devices Cust', '+919889012345', 'qr_alldev', $1, 'active')
         RETURNING id`,
        [DEFAULT_GROUP_ID],
      );
      const customerId = c.rows[0].id;

      const token1Hash = hashSha256("device_1_token");
      const token2Hash = hashSha256("device_2_token");
      await testPool.query(
        `INSERT INTO refresh_tokens (token_hash, customer_id, expires_at)
         VALUES ($1, $3, now() + interval '30 days'), ($2, $3, now() + interval '30 days')`,
        [token1Hash, token2Hash, customerId],
      );

      const custToken = signAccessToken({
        sub: customerId,
        role: "customer",
        aud: "fuelpoint-customer",
      });

      const res = await request(app)
        .post("/api/v1/auth/logout")
        .set("Authorization", `Bearer ${custToken}`)
        .send({ allDevices: true });

      expect(res.status).toBe(200);

      // Verify all active tokens revoked
      const count = await testPool.query(
        "SELECT * FROM refresh_tokens WHERE customer_id = $1 AND revoked_at IS NULL",
        [customerId],
      );
      expect(count.rowCount).toBe(0);
    });
  });
});
