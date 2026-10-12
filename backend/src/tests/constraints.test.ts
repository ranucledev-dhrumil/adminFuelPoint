import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { testPool, ensureTestDatabaseMigrated, truncateAllTables } from "./test-db.js";

describe("Database Constraints, Indexes & Triggers (fuelpoint_test)", () => {
  beforeAll(async () => {
    await ensureTestDatabaseMigrated();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await testPool.end();
  });

  // Helper to insert a baseline group
  async function insertGroup(
    overrides: {
      id?: string;
      name?: string;
      discountPercent?: number;
      isDefault?: boolean;
      deletedAt?: Date | null;
    } = {},
  ) {
    const res = await testPool.query(
      `INSERT INTO groups (id, name, discount_percent, is_default, deleted_at)
       VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5)
       RETURNING id, name, discount_percent, is_default, deleted_at`,
      [
        overrides.id || null,
        overrides.name ?? "Standard Group",
        overrides.discountPercent ?? 5.0,
        overrides.isDefault ?? false,
        overrides.deletedAt ?? null,
      ],
    );
    return res.rows[0];
  }

  // Helper to insert a baseline admin
  async function insertAdmin(overrides: { email?: string; phone?: string | null } = {}) {
    const res = await testPool.query(
      `INSERT INTO admin_users (name, email, phone, password_hash, initials, is_active)
       VALUES ('Admin User', $1, $2, 'argon2id$mockhash', 'AU', TRUE)
       RETURNING id, email, phone`,
      [
        overrides.email ?? "admin@test.local",
        overrides.phone === undefined ? "+919876543210" : overrides.phone,
      ],
    );
    return res.rows[0];
  }

  // Helper to insert a baseline customer
  async function insertCustomer(
    overrides: {
      groupId?: string;
      phone?: string;
      email?: string | null;
      qrToken?: string;
      deletedAt?: Date | null;
    } = {},
  ) {
    const group = overrides.groupId ? { id: overrides.groupId } : await insertGroup();
    const qrToken = overrides.qrToken ?? `qr_${Math.random()}`;
    const res = await testPool.query(
      `INSERT INTO customers (name, phone, email, qr_token, group_id, deleted_at)
       VALUES ('Customer Test', $1, $2, $3, $4, $5)
       RETURNING id, phone, email, qr_token, group_id, deleted_at`,
      [
        overrides.phone ?? "+919999900001",
        overrides.email === undefined ? "customer@test.local" : overrides.email,
        qrToken,
        group.id,
        overrides.deletedAt ?? null,
      ],
    );
    return res.rows[0];
  }

  // Helper to insert a baseline worker
  async function insertWorker(
    overrides: {
      phone?: string;
      email?: string;
      shift?: string;
      status?: string;
      deletedAt?: Date | null;
    } = {},
  ) {
    const res = await testPool.query(
      `INSERT INTO workers (name, phone, email, shift, status, deleted_at)
       VALUES ('Worker Test', $1, $2, $3, $4, $5)
       RETURNING id, phone, email, shift, status, deleted_at`,
      [
        overrides.phone ?? "+919888800001",
        overrides.email ?? "worker@test.local",
        overrides.shift ?? "Morning",
        overrides.status ?? "active",
        overrides.deletedAt ?? null,
      ],
    );
    return res.rows[0];
  }

  // ============================================================================
  // 1. Partial Unique Indexes & Soft-Delete Exclusion
  // ============================================================================
  describe("Partial Unique Indexes (Soft-Delete Exclusion)", () => {
    it("groups.name: prevents duplicate active name, allows duplicate when previous is soft-deleted", async () => {
      await insertGroup({ name: "Gold" });

      // Duplicate active should fail
      await expect(insertGroup({ name: "Gold" })).rejects.toThrow(/idx_groups_name|duplicate key/);

      // Soft-delete the first Gold group
      await testPool.query(`UPDATE groups SET deleted_at = now() WHERE name = 'Gold'`);

      // Now inserting Gold again should succeed
      const newGroup = await insertGroup({ name: "Gold" });
      expect(newGroup.name).toBe("Gold");
      expect(newGroup.deleted_at).toBeNull();
    });

    it("groups.is_default: allows exactly one active default group, allows new default if previous is soft-deleted", async () => {
      await insertGroup({ name: "Default 1", isDefault: true });

      // Inserting a second active default group must fail
      await expect(insertGroup({ name: "Default 2", isDefault: true })).rejects.toThrow(
        /idx_groups_default|duplicate key/,
      );

      // Soft-delete the first default group
      await testPool.query(`UPDATE groups SET deleted_at = now() WHERE is_default = TRUE`);

      // Now inserting a new active default group succeeds
      const newDefault = await insertGroup({ name: "Default 2", isDefault: true });
      expect(newDefault.is_default).toBe(true);
    });

    it("customers.phone: prevents duplicate active phone, allows duplicate when previous is soft-deleted", async () => {
      const g = await insertGroup();
      await insertCustomer({ groupId: g.id, phone: "+919111122222", email: "c1@test.local" });

      // Duplicate phone while active must fail
      await expect(
        insertCustomer({ groupId: g.id, phone: "+919111122222", email: "c2@test.local" }),
      ).rejects.toThrow(/idx_customers_phone|duplicate key/);

      // Soft-delete the first customer
      await testPool.query(`UPDATE customers SET deleted_at = now() WHERE phone = '+919111122222'`);

      // Now inserting with the same phone succeeds
      const newCust = await insertCustomer({
        groupId: g.id,
        phone: "+919111122222",
        email: "c3@test.local",
      });
      expect(newCust.phone).toBe("+919111122222");
    });

    it("customers.email: prevents duplicate active email, allows duplicate when soft-deleted, allows multiple NULLs", async () => {
      const g = await insertGroup();
      await insertCustomer({ groupId: g.id, phone: "+919111100001", email: "unique@test.local" });

      // Duplicate email while active must fail
      await expect(
        insertCustomer({ groupId: g.id, phone: "+919111100002", email: "unique@test.local" }),
      ).rejects.toThrow(/idx_customers_email|duplicate key/);

      // Multiple customers with email = NULL must succeed
      const nullEmail1 = await insertCustomer({
        groupId: g.id,
        phone: "+919111100003",
        email: null,
      });
      const nullEmail2 = await insertCustomer({
        groupId: g.id,
        phone: "+919111100004",
        email: null,
      });
      expect(nullEmail1.email).toBeNull();
      expect(nullEmail2.email).toBeNull();

      // Soft-delete the customer with unique@test.local
      await testPool.query(
        `UPDATE customers SET deleted_at = now() WHERE email = 'unique@test.local'`,
      );

      // Now inserting with unique@test.local succeeds
      const newCust = await insertCustomer({
        groupId: g.id,
        phone: "+919111100005",
        email: "unique@test.local",
      });
      expect(newCust.email).toBe("unique@test.local");
    });

    it("customers.qr_token: global unfiltered uniqueness rejects duplicate even if first customer is soft-deleted", async () => {
      const g = await insertGroup();
      await insertCustomer({ groupId: g.id, phone: "+919222200001", qrToken: "token_fixed_123" });

      // Soft-delete the customer
      await testPool.query(
        `UPDATE customers SET deleted_at = now() WHERE qr_token = 'token_fixed_123'`,
      );

      // Re-using the same qr_token must still fail because QR uniqueness is global (unfiltered)
      await expect(
        insertCustomer({ groupId: g.id, phone: "+919222200002", qrToken: "token_fixed_123" }),
      ).rejects.toThrow(/uq_customers_qr_token|duplicate key/);
    });

    it("workers.phone & email: prevents duplicate active, allows duplicate when soft-deleted", async () => {
      await insertWorker({ phone: "+919333300001", email: "w1@test.local" });

      // Duplicate phone
      await expect(
        insertWorker({ phone: "+919333300001", email: "w2@test.local" }),
      ).rejects.toThrow(/idx_workers_phone|duplicate key/);

      // Duplicate email
      await expect(
        insertWorker({ phone: "+919333300002", email: "w1@test.local" }),
      ).rejects.toThrow(/idx_workers_email|duplicate key/);

      // Soft-delete worker 1
      await testPool.query(`UPDATE workers SET deleted_at = now() WHERE email = 'w1@test.local'`);

      // Both phone and email can now be reused
      const newWorker = await insertWorker({ phone: "+919333300001", email: "w1@test.local" });
      expect(newWorker.phone).toBe("+919333300001");
      expect(newWorker.email).toBe("w1@test.local");
    });

    it("admin_users.email & phone: enforces unique email and unique non-null phone", async () => {
      await insertAdmin({ email: "super@test.local", phone: "+919444400001" });

      // Duplicate email fails
      await expect(
        insertAdmin({ email: "super@test.local", phone: "+919444400002" }),
      ).rejects.toThrow(/uq_admin_users_email|duplicate key/);

      // Duplicate non-null phone fails
      await expect(
        insertAdmin({ email: "other@test.local", phone: "+919444400001" }),
      ).rejects.toThrow(/idx_admin_users_phone|duplicate key/);

      // Multiple admins with phone = NULL succeed
      const adminNull1 = await insertAdmin({ email: "n1@test.local", phone: null });
      const adminNull2 = await insertAdmin({ email: "n2@test.local", phone: null });
      expect(adminNull1.phone).toBeNull();
      expect(adminNull2.phone).toBeNull();
    });

    it("refresh_tokens.token_hash: enforces global uniqueness", async () => {
      const admin = await insertAdmin({ email: "a_token@test.local" });
      await testPool.query(
        `INSERT INTO refresh_tokens (token_hash, admin_user_id, expires_at)
         VALUES ('hash_abc_123', $1, now() + interval '7 days')`,
        [admin.id],
      );

      // Duplicate token_hash fails
      await expect(
        testPool.query(
          `INSERT INTO refresh_tokens (token_hash, admin_user_id, expires_at)
           VALUES ('hash_abc_123', $1, now() + interval '7 days')`,
          [admin.id],
        ),
      ).rejects.toThrow(/uq_refresh_tokens_token_hash|duplicate key/);
    });
  });

  // ============================================================================
  // 2. CHECK Constraints
  // ============================================================================
  describe("CHECK Constraints", () => {
    it("groups.discount_percent: must be between 0 and 100", async () => {
      await expect(insertGroup({ name: "Neg", discountPercent: -1 })).rejects.toThrow(
        /chk_groups_discount_percent/,
      );
      await expect(insertGroup({ name: "Over", discountPercent: 100.01 })).rejects.toThrow(
        /chk_groups_discount_percent/,
      );

      const g0 = await insertGroup({ name: "Zero", discountPercent: 0 });
      const g100 = await insertGroup({ name: "Max", discountPercent: 100 });
      expect(Number(g0.discount_percent)).toBe(0);
      expect(Number(g100.discount_percent)).toBe(100);
    });

    it("transactions: validates amount > 0, discount_percent 0..100, discount_amount >= 0 and <= amount", async () => {
      const group = await insertGroup({ name: "TxGroup", discountPercent: 10 });
      const customer = await insertCustomer({ groupId: group.id });
      const worker = await insertWorker();

      const insertTx = (
        amt: number,
        discPct: number,
        discAmt: number,
        litres: number | null = null,
      ) =>
        testPool.query(
          `INSERT INTO transactions (customer_id, worker_id, group_id, amount, discount_percent, discount_amount, litres)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [customer.id, worker.id, group.id, amt, discPct, discAmt, litres],
        );

      // Amount <= 0 fails
      await expect(insertTx(0, 10, 0)).rejects.toThrow(/chk_transactions_amount/);
      await expect(insertTx(-50, 10, 0)).rejects.toThrow(/chk_transactions_amount/);

      // discount_percent < 0 or > 100 fails
      await expect(insertTx(100, -5, 0)).rejects.toThrow(/chk_transactions_discount_percent/);
      await expect(insertTx(100, 105, 0)).rejects.toThrow(/chk_transactions_discount_percent/);

      // discount_amount < 0 fails
      await expect(insertTx(100, 10, -5)).rejects.toThrow(/chk_transactions_discount_amount/);

      // discount_amount > amount fails
      await expect(insertTx(100, 10, 105)).rejects.toThrow(/chk_transactions_discount_lte_amount/);

      // litres <= 0 fails; NULL or > 0 succeeds
      await expect(insertTx(100, 10, 10, 0)).rejects.toThrow(/chk_transactions_litres/);
      await expect(insertTx(100, 10, 10, -2.5)).rejects.toThrow(/chk_transactions_litres/);

      const validWithLitres = await insertTx(100, 10, 10, 25.5);
      expect(validWithLitres.rowCount).toBe(1);

      const validNullLitres = await insertTx(100, 10, 10, null);
      expect(validNullLitres.rowCount).toBe(1);
    });

    it("refresh_tokens: exactly one actor must be set (num_nonnulls = 1)", async () => {
      const admin = await insertAdmin({ email: "admin_tok@test.local" });
      const group = await insertGroup();
      const customer = await insertCustomer({ groupId: group.id });
      const worker = await insertWorker();

      const insertToken = (
        adminId: string | null,
        custId: string | null,
        workerId: string | null,
      ) =>
        testPool.query(
          `INSERT INTO refresh_tokens (token_hash, admin_user_id, customer_id, worker_id, expires_at)
           VALUES ($1, $2, $3, $4, now() + interval '7 days')`,
          [`hash_${Math.random()}`, adminId, custId, workerId],
        );

      // 0 actors fails
      await expect(insertToken(null, null, null)).rejects.toThrow(/chk_refresh_tokens_actor/);

      // 2 actors fails
      await expect(insertToken(admin.id, customer.id, null)).rejects.toThrow(
        /chk_refresh_tokens_actor/,
      );
      await expect(insertToken(null, customer.id, worker.id)).rejects.toThrow(
        /chk_refresh_tokens_actor/,
      );

      // 3 actors fails
      await expect(insertToken(admin.id, customer.id, worker.id)).rejects.toThrow(
        /chk_refresh_tokens_actor/,
      );

      // Exactly 1 actor succeeds
      const tokAdmin = await insertToken(admin.id, null, null);
      const tokCust = await insertToken(null, customer.id, null);
      const tokWorker = await insertToken(null, null, worker.id);

      expect(tokAdmin.rowCount).toBe(1);
      expect(tokCust.rowCount).toBe(1);
      expect(tokWorker.rowCount).toBe(1);
    });

    it("otp_codes: actor_type and actor_id must be both NULL or both set; attempts >= 0", async () => {
      const group = await insertGroup();
      const customer = await insertCustomer({ groupId: group.id });

      const insertOtp = (actorType: string | null, actorId: string | null, attempts = 0) =>
        testPool.query(
          `INSERT INTO otp_codes (channel, destination, actor_type, actor_id, code_hash, purpose, expires_at, attempts)
           VALUES ('sms', '+919999988888', $1, $2, 'hash123', 'login', now() + interval '5 minutes', $3)`,
          [actorType, actorId, attempts],
        );

      // Both NULL succeeds (pre-registration)
      const resNull = await insertOtp(null, null);
      expect(resNull.rowCount).toBe(1);

      // Both set succeeds
      const resSet = await insertOtp("customer", customer.id);
      expect(resSet.rowCount).toBe(1);

      // Only actor_type set fails
      await expect(insertOtp("customer", null)).rejects.toThrow(/chk_otp_actor/);

      // Only actor_id set fails
      await expect(insertOtp(null, customer.id)).rejects.toThrow(/chk_otp_actor/);

      // Negative attempts fails
      await expect(insertOtp(null, null, -1)).rejects.toThrow(/chk_otp_attempts/);
    });

    it("notifications: at most one entity can be linked (customer_id or worker_id, not both)", async () => {
      const group = await insertGroup();
      const customer = await insertCustomer({ groupId: group.id });
      const worker = await insertWorker();

      const insertNotif = (custId: string | null, workerId: string | null) =>
        testPool.query(
          `INSERT INTO notifications (type, title, message, customer_id, worker_id)
           VALUES ('registration', 'Title', 'Message', $1, $2)`,
          [custId, workerId],
        );

      // Neither succeeds
      const resNeither = await insertNotif(null, null);
      expect(resNeither.rowCount).toBe(1);

      // Customer only succeeds
      const resCust = await insertNotif(customer.id, null);
      expect(resCust.rowCount).toBe(1);

      // Worker only succeeds
      const resWorker = await insertNotif(null, worker.id);
      expect(resWorker.rowCount).toBe(1);

      // Both fails
      await expect(insertNotif(customer.id, worker.id)).rejects.toThrow(/chk_notifications_entity/);
    });
  });

  // ============================================================================
  // 3. Foreign Key RESTRICT Behavior
  // ============================================================================
  describe("Foreign Key RESTRICT Behavior", () => {
    it("groups: cannot hard-delete a group referenced by a customer (ON DELETE RESTRICT)", async () => {
      const group = await insertGroup({ name: "ActiveGroup" });
      await insertCustomer({ groupId: group.id });

      // Attempting to delete the group must fail with foreign key violation
      await expect(testPool.query(`DELETE FROM groups WHERE id = $1`, [group.id])).rejects.toThrow(
        /foreign key constraint|violates foreign key/,
      );
    });

    it("customers & workers: cannot hard-delete a customer or worker referenced by a transaction", async () => {
      const group = await insertGroup();
      const customer = await insertCustomer({ groupId: group.id });
      const worker = await insertWorker();

      await testPool.query(
        `INSERT INTO transactions (customer_id, worker_id, group_id, amount, discount_percent, discount_amount)
         VALUES ($1, $2, $3, 500, 0, 0)`,
        [customer.id, worker.id, group.id],
      );

      // Deleting customer must fail
      await expect(
        testPool.query(`DELETE FROM customers WHERE id = $1`, [customer.id]),
      ).rejects.toThrow(/foreign key constraint|violates foreign key/);

      // Deleting worker must fail
      await expect(
        testPool.query(`DELETE FROM workers WHERE id = $1`, [worker.id]),
      ).rejects.toThrow(/foreign key constraint|violates foreign key/);
    });

    it("customers & workers: cannot hard-delete an actor referenced by a refresh_token", async () => {
      const group = await insertGroup();
      const customer = await insertCustomer({ groupId: group.id });
      const worker = await insertWorker();

      await testPool.query(
        `INSERT INTO refresh_tokens (token_hash, customer_id, expires_at)
         VALUES ('hash_c1', $1, now() + interval '30 days')`,
        [customer.id],
      );

      await testPool.query(
        `INSERT INTO refresh_tokens (token_hash, worker_id, expires_at)
         VALUES ('hash_w1', $1, now() + interval '30 days')`,
        [worker.id],
      );

      // Deleting customer fails due to RESTRICT
      await expect(
        testPool.query(`DELETE FROM customers WHERE id = $1`, [customer.id]),
      ).rejects.toThrow(/foreign key constraint|violates foreign key/);

      // Deleting worker fails due to RESTRICT
      await expect(
        testPool.query(`DELETE FROM workers WHERE id = $1`, [worker.id]),
      ).rejects.toThrow(/foreign key constraint|violates foreign key/);
    });
  });

  // ============================================================================
  // 4. Triggers: updated_at & audit_logs immutability
  // ============================================================================
  describe("Database Triggers", () => {
    it("set_updated_at trigger automatically advances updated_at on UPDATE", async () => {
      const group = await insertGroup({ name: "TriggerGroup" });
      const initialUpdatedAt = (
        await testPool.query(`SELECT updated_at FROM groups WHERE id = $1`, [group.id])
      ).rows[0].updated_at;

      // Small delay to ensure timestamp resolution difference
      await new Promise((r) => setTimeout(r, 50));

      await testPool.query(`UPDATE groups SET description = 'Updated description' WHERE id = $1`, [
        group.id,
      ]);

      const updatedUpdatedAt = (
        await testPool.query(`SELECT updated_at FROM groups WHERE id = $1`, [group.id])
      ).rows[0].updated_at;

      expect(new Date(updatedUpdatedAt).getTime()).toBeGreaterThan(
        new Date(initialUpdatedAt).getTime(),
      );
    });

    it("prevent_audit_mutation trigger rejects UPDATE and DELETE on audit_logs", async () => {
      const res = await testPool.query(
        `INSERT INTO audit_logs (actor_type, action)
         VALUES ('admin', 'admin.login')
         RETURNING id`,
      );
      const auditId = res.rows[0].id;

      // UPDATE must be rejected
      await expect(
        testPool.query(`UPDATE audit_logs SET action = 'tampered' WHERE id = $1`, [auditId]),
      ).rejects.toThrow(/audit_logs rows are immutable and cannot be updated or deleted/);

      // DELETE must be rejected
      await expect(
        testPool.query(`DELETE FROM audit_logs WHERE id = $1`, [auditId]),
      ).rejects.toThrow(/audit_logs rows are immutable and cannot be updated or deleted/);
    });
  });
});
