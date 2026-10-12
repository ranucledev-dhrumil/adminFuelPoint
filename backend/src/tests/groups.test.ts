import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { testPool, ensureTestDatabaseMigrated, truncateAllTables } from "./test-db.js";
import { hashPassword, signAccessToken } from "../common/utils/crypto.js";
import { DEFAULT_GROUP_ID, seedDefaultGroup } from "../seeds/default-group.seed.js";

describe("Admin Groups Management Integration Tests", () => {
  const PASSWORD = "SecurePassword123!";
  let adminId: string;
  let adminToken: string;

  beforeAll(async () => {
    await ensureTestDatabaseMigrated();
  });

  beforeEach(async () => {
    await truncateAllTables();

    // 1. Seed Default Group
    await seedDefaultGroup(testPool);

    // 2. Seed Admin User
    const passwordHash = await hashPassword(PASSWORD);
    const res = await testPool.query(
      `INSERT INTO admin_users (name, email, phone, password_hash, role, location, initials, is_active)
       VALUES ('Admin GroupMgr', 'groupmgr@test.local', '+919876543210', $1, 'Super Admin', 'HQ', 'AG', TRUE)
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
  // 1. Authentication and Authorization Guards
  // ============================================================================
  describe("Auth & Role Guards", () => {
    it("returns 401 Unauthorized when Authorization header is missing", async () => {
      const res = await request(app).get("/api/v1/admin/groups");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("MISSING_TOKEN");
    });

    it("returns 403 Forbidden when accessed by a worker role", async () => {
      const workerToken = signAccessToken({
        sub: "00000000-0000-0000-0000-000000000088",
        role: "worker",
        aud: "fuelpoint-worker",
      });

      const res = await request(app)
        .get("/api/v1/admin/groups")
        .set("Authorization", `Bearer ${workerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 Forbidden when accessed by a customer role", async () => {
      const customerToken = signAccessToken({
        sub: "00000000-0000-0000-0000-000000000077",
        role: "customer",
        aud: "fuelpoint-customer",
      });

      const res = await request(app)
        .post("/api/v1/admin/groups")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ name: "Hacker VIP", discountPercent: 10 });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  // ============================================================================
  // 2. GET /api/v1/admin/groups (List Groups with Customer Count)
  // ============================================================================
  describe("GET /api/v1/admin/groups", () => {
    it("returns all non-deleted groups with accurate customer count, default group first", async () => {
      // Create a second group
      const customRes = await testPool.query(
        `INSERT INTO groups (name, discount_percent, description, active, is_default)
         VALUES ('Fleet VIP', 5.00, 'Fleet business discount', TRUE, FALSE)
         RETURNING id`,
      );
      const fleetId = customRes.rows[0].id;

      // Create a soft-deleted group (must NOT appear in list)
      await testPool.query(
        `INSERT INTO groups (name, discount_percent, description, active, is_default, deleted_at)
         VALUES ('Archived Group', 2.00, 'Old group', FALSE, FALSE, now())`,
      );

      // Add 2 active customers to Fleet VIP
      await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id, status)
         VALUES ('Alice Customer', '+919111111111', 'qr_alice_01', $1, 'active'),
                ('Bob Customer', '+919222222222', 'qr_bob_02', $1, 'active')`,
        [fleetId],
      );

      // Add 1 soft-deleted customer to Fleet VIP (must NOT count)
      await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id, status, deleted_at)
         VALUES ('Deleted Dave', '+919333333333', 'qr_dave_03', $1, 'active', now())`,
        [fleetId],
      );

      // Add 1 customer to Default Group
      await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id, status)
         VALUES ('Charlie Default', '+919444444444', 'qr_charlie_04', $1, 'active')`,
        [DEFAULT_GROUP_ID],
      );

      const res = await request(app)
        .get("/api/v1/admin/groups")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.groups).toBeDefined();
      expect(res.body.groups.length).toBe(2);

      // Default group is first
      expect(res.body.groups[0].isDefault).toBe(true);
      expect(res.body.groups[0].customerCount).toBe(1);

      // Fleet VIP has 2 active customers
      const fleetGroup = res.body.groups.find((g: { id: string }) => g.id === fleetId);
      expect(fleetGroup).toBeDefined();
      expect(fleetGroup.name).toBe("Fleet VIP");
      expect(fleetGroup.discountPercent).toBe("5.00");
      expect(fleetGroup.customerCount).toBe(2);
      expect(fleetGroup.active).toBe(true);
    });
  });

  // ============================================================================
  // 3. POST /api/v1/admin/groups (Create Group)
  // ============================================================================
  describe("POST /api/v1/admin/groups", () => {
    it("successfully creates a new group and commits group.created audit log in same transaction", async () => {
      const payload = {
        name: "Corporate Gold",
        discountPercent: 7.5,
        description: "Special corporate tier",
        active: true,
      };

      const res = await request(app)
        .post("/api/v1/admin/groups")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.group).toBeDefined();
      expect(res.body.group.name).toBe("Corporate Gold");
      expect(res.body.group.discountPercent).toBe("7.50");
      expect(res.body.group.description).toBe("Special corporate tier");
      expect(res.body.group.active).toBe(true);
      expect(res.body.group.isDefault).toBe(false);
      expect(res.body.group.customerCount).toBe(0);

      const createdId = res.body.group.id;

      // Verify audit entry committed in DB
      const auditRes = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'group.created' AND entity_id = $1",
        [createdId],
      );
      expect(auditRes.rowCount).toBe(1);
      const audit = auditRes.rows[0];
      expect(audit.actor_type).toBe("admin");
      expect(audit.actor_id).toBe(adminId);
      expect(audit.new_value.name).toBe("Corporate Gold");
      expect(audit.new_value.discountPercent).toBe("7.50");
    });

    it("rejects duplicate group name with 409 Conflict", async () => {
      await request(app)
        .post("/api/v1/admin/groups")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Silver Tier", discountPercent: 3.0 });

      // Duplicate attempt
      const res = await request(app)
        .post("/api/v1/admin/groups")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Silver Tier", discountPercent: 4.0 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("DUPLICATE_GROUP_NAME");
    });

    it("rejects discount percent less than 0 with 422 Validation Error", async () => {
      const res = await request(app)
        .post("/api/v1/admin/groups")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Negative Discount", discountPercent: -5 });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects discount percent greater than 100 with 422 Validation Error", async () => {
      const res = await request(app)
        .post("/api/v1/admin/groups")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Excess Discount", discountPercent: 105 });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects empty group name with 422 Validation Error", async () => {
      const res = await request(app)
        .post("/api/v1/admin/groups")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "   ", discountPercent: 5 });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // ============================================================================
  // 4. PATCH /api/v1/admin/groups/:id (Edit Group)
  // ============================================================================
  describe("PATCH /api/v1/admin/groups/:id", () => {
    it("successfully edits custom group and records group.updated audit log", async () => {
      const createRes = await request(app)
        .post("/api/v1/admin/groups")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Bronze Initial", discountPercent: 1.0, description: "Initial" });

      const groupId = createRes.body.group.id;

      const editRes = await request(app)
        .patch(`/api/v1/admin/groups/${groupId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Bronze Updated", discountPercent: 2.5, description: "Updated description" });

      expect(editRes.status).toBe(200);
      expect(editRes.body.group.name).toBe("Bronze Updated");
      expect(editRes.body.group.discountPercent).toBe("2.50");
      expect(editRes.body.group.description).toBe("Updated description");

      // Verify audit log
      const auditRes = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'group.updated' AND entity_id = $1",
        [groupId],
      );
      expect(auditRes.rowCount).toBe(1);
      const audit = auditRes.rows[0];
      expect(audit.old_value.name).toBe("Bronze Initial");
      expect(audit.new_value.name).toBe("Bronze Updated");
      expect(audit.new_value.discountPercent).toBe("2.50");
    });

    it("allows editing name and discountPercent on the default group", async () => {
      const editRes = await request(app)
        .patch(`/api/v1/admin/groups/${DEFAULT_GROUP_ID}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "General Default Tier", discountPercent: 1.0 });

      expect(editRes.status).toBe(200);
      expect(editRes.body.group.id).toBe(DEFAULT_GROUP_ID);
      expect(editRes.body.group.name).toBe("General Default Tier");
      expect(editRes.body.group.discountPercent).toBe("1.00");
      expect(editRes.body.group.isDefault).toBe(true);

      // Verify audit
      const auditRes = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'group.updated' AND entity_id = $1",
        [DEFAULT_GROUP_ID],
      );
      expect(auditRes.rowCount).toBe(1);
    });

    it("returns 404 Not Found when group does not exist", async () => {
      const res = await request(app)
        .patch("/api/v1/admin/groups/99999999-9999-9999-9999-999999999999")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Ghost" });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("GROUP_NOT_FOUND");
    });

    it("returns 409 Conflict when new name is already taken by another group", async () => {
      await request(app)
        .post("/api/v1/admin/groups")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Alpha Tier", discountPercent: 2 });

      const betaRes = await request(app)
        .post("/api/v1/admin/groups")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Beta Tier", discountPercent: 3 });

      const betaId = betaRes.body.group.id;

      // Attempt to rename Beta to Alpha
      const conflictRes = await request(app)
        .patch(`/api/v1/admin/groups/${betaId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Alpha Tier" });

      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.error.code).toBe("DUPLICATE_GROUP_NAME");
    });

    it("returns 422 when updated discount percent is out of range", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/groups/${DEFAULT_GROUP_ID}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ discountPercent: -1 });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // ============================================================================
  // 5. PATCH /api/v1/admin/groups/:id/toggle-active
  // ============================================================================
  describe("PATCH /api/v1/admin/groups/:id/toggle-active", () => {
    it("successfully toggles active state and logs group.toggled audit", async () => {
      const createRes = await request(app)
        .post("/api/v1/admin/groups")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Toggleable Group", discountPercent: 4.0, active: true });

      const groupId = createRes.body.group.id;

      // 1. Toggle to inactive
      const toggle1 = await request(app)
        .patch(`/api/v1/admin/groups/${groupId}/toggle-active`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(toggle1.status).toBe(200);
      expect(toggle1.body.group.active).toBe(false);

      // Verify audit
      const audit1 = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'group.toggled' AND entity_id = $1 ORDER BY created_at DESC LIMIT 1",
        [groupId],
      );
      expect(audit1.rows[0].old_value).toEqual({ active: true });
      expect(audit1.rows[0].new_value).toEqual({ active: false });

      // 2. Toggle back to active
      const toggle2 = await request(app)
        .patch(`/api/v1/admin/groups/${groupId}/toggle-active`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(toggle2.status).toBe(200);
      expect(toggle2.body.group.active).toBe(true);
    });

    it("rejects deactivating the default group with 400 Bad Request", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/groups/${DEFAULT_GROUP_ID}/toggle-active`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("CANNOT_DEACTIVATE_DEFAULT_GROUP");
      expect(res.body.error.message).toContain("default group cannot be deactivated");

      // Verify DB remains active
      const dbGroup = await testPool.query("SELECT active FROM groups WHERE id = $1", [
        DEFAULT_GROUP_ID,
      ]);
      expect(dbGroup.rows[0].active).toBe(true);
    });

    it("returns 404 when group is not found", async () => {
      const res = await request(app)
        .patch("/api/v1/admin/groups/00000000-0000-0000-0000-000000000999/toggle-active")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("GROUP_NOT_FOUND");
    });
  });

  // ============================================================================
  // 6. DELETE /api/v1/admin/groups/:id (Delete and Member Reassignment)
  // ============================================================================
  describe("DELETE /api/v1/admin/groups/:id", () => {
    it("deleting a group moves all its members to default group in same transaction and records audit log", async () => {
      // 1. Create a group to be deleted
      const createRes = await request(app)
        .post("/api/v1/admin/groups")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Temporary Group", discountPercent: 6.0 });

      const tempGroupId = createRes.body.group.id;

      // 2. Add 3 customers belonging to this group
      await testPool.query(
        `INSERT INTO customers (name, phone, qr_token, group_id, status)
         VALUES ('Member One', '+919811111111', 'qr_m1', $1, 'active'),
                ('Member Two', '+919822222222', 'qr_m2', $1, 'active'),
                ('Member Three', '+919833333333', 'qr_m3', $1, 'active')`,
        [tempGroupId],
      );

      // Verify customers are in temp group
      const initialCount = await testPool.query(
        "SELECT COUNT(*)::int AS count FROM customers WHERE group_id = $1",
        [tempGroupId],
      );
      expect(initialCount.rows[0].count).toBe(3);

      // 3. Delete group
      const delRes = await request(app)
        .delete(`/api/v1/admin/groups/${tempGroupId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.message).toContain("Group deleted; members reassigned to default group");

      // 4. Verify group is soft deleted
      const groupInDb = await testPool.query("SELECT deleted_at FROM groups WHERE id = $1", [
        tempGroupId,
      ]);
      expect(groupInDb.rows[0].deleted_at).not.toBeNull();

      // 5. Verify ALL customers were moved to default group
      const remainingInTemp = await testPool.query(
        "SELECT COUNT(*)::int AS count FROM customers WHERE group_id = $1",
        [tempGroupId],
      );
      expect(remainingInTemp.rows[0].count).toBe(0);

      const reassignedCustomers = await testPool.query(
        "SELECT id FROM customers WHERE group_id = $1",
        [DEFAULT_GROUP_ID],
      );
      expect(reassignedCustomers.rowCount).toBe(3);

      // 6. Verify audit log entry
      const auditRes = await testPool.query(
        "SELECT * FROM audit_logs WHERE action = 'group.deleted' AND entity_id = $1",
        [tempGroupId],
      );
      expect(auditRes.rowCount).toBe(1);
      const audit = auditRes.rows[0];
      expect(audit.actor_type).toBe("admin");
      expect(audit.new_value.name).toBe("Temporary Group");
      expect(audit.new_value.membersReassigned).toBe(3);
    });

    it("rejects deleting the default group with 400 Bad Request", async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/groups/${DEFAULT_GROUP_ID}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("CANNOT_DELETE_DEFAULT_GROUP");
      expect(res.body.error.message).toContain("default group cannot be deleted");

      // Verify default group is still not deleted
      const dbGroup = await testPool.query("SELECT deleted_at FROM groups WHERE id = $1", [
        DEFAULT_GROUP_ID,
      ]);
      expect(dbGroup.rows[0].deleted_at).toBeNull();
    });

    it("returns 404 when group to delete does not exist", async () => {
      const res = await request(app)
        .delete("/api/v1/admin/groups/00000000-0000-0000-0000-000000000777")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("GROUP_NOT_FOUND");
    });

    it("returns 422 when invalid UUID format is supplied in path", async () => {
      const res = await request(app)
        .delete("/api/v1/admin/groups/not-a-valid-uuid")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });
});
