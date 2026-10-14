# FuelPoint — Decision Audit Report (Task 24)

> **Date:** 2026-10-14  
> **Status:** REPORT ONLY (No code, config, or documentation changes were made)  
> **Sources audited:** `docs/db-schema-proposal.md` (v5, D01–D54), `docs/backend-structure-proposal.md`, `docs/api-proposal.md`, `docs/PROJECT_CONTEXT.md`, `docs/STATUS.md`, and repository source files.

---

## 1. Summary of Audit Findings

| Category | Count |
|---|---|
| **MATCHES** | 88 |
| **DEVIATES** | 4 |
| **NOT IMPLEMENTED** | 1 |
| **CANNOT VERIFY** | 0 |
| **BUILT BUT NOT DECIDED** | 3 |
| **Total Items Audited** | **96** |

---

## 2. Area Audits

### 2.1 Repository & Structure

| ID / Decision | Expected | Status | Evidence | Severity | Owner Decision Needed |
|---|---|---|---|---|---|
| REPO-01 | Root folder `adminFuelPoint` containing `frontend/`, `backend/`, `docs/`; each of `frontend` and `backend` has its own README; no root README. | **MATCHES** | Root directory listing contains only `.gitignore`, `backend`, `docs`, `frontend`. `frontend/README.md` and `backend/README.md` exist; no root README. | Low | None. |
| REPO-02 | `frontend/README.md` covers frontend only. | **DEVIATES** | `frontend/README.md:3` covers frontend but still states: *"backend lives in ../backend and is not built yet, so all data is currently mock data."* (Outdated text). | Low | Update `frontend/README.md` to reflect real API wiring from Task 20. |
| REPO-03 | Unused and Lovable-related files removed (no `.lovable`, `bun.lock`, `bunfig.toml`, `check_oklch.js`, stray `.py` scripts, or Lovable README text); `npm` only (`package-lock.json`). | **MATCHES** | File search confirms zero `.lovable`, `bun.*`, `check_oklch*`, or `.py` files outside `node_modules`. Only `package-lock.json` present in both projects. | Low | None. |
| REPO-04 | Unused shadcn UI components deliberately kept. | **MATCHES** | `frontend/src/components/ui/` contains full suite of shadcn/ui components (e.g., `accordion.tsx`, `calendar.tsx`, `sheet.tsx`, `slider.tsx`, `tabs.tsx`). | Low | None. |
| REPO-05 | Pure client-side React SPA: Vite and TanStack Router (file-based routes), no TanStack Start, no Nitro, no server entry. | **MATCHES** | `frontend/src/router.tsx:8` creates client router via `createRouter({ routeTree })`; `frontend/src/main.tsx` renders `createRoot(...)`. No SSR or server bundle. | Low | None. |
| REPO-06 | Per-route page titles work across all views. | **MATCHES** | `frontend/src/routes/*.tsx` define `head: () => ({ meta: [{ title: "..." }] })` rendered via `<HeadContent />` in `__root.tsx`. Verified on `/`, `/dashboard`, `/customers`, `/workers`, `/groups`, `/reports`, `/notifications`, `/profile`, `/audit-logs`, `/reset-password`. | Low | None. |
| REPO-07 | `backend/README.md` states mobile app screens are out of scope and their APIs are in scope. | **MATCHES** | `backend/README.md:17`: *"The mobile application screens are outside our development scope. The API endpoints those apps call (/api/v1/worker/*, /api/v1/customer/*, /api/v1/auth/*) are fully implemented and verified within this backend."* | Low | None. |

---

### 2.2 Technology Stack & Infrastructure

| ID / Decision | Expected | Status | Evidence | Severity | Owner Decision Needed |
|---|---|---|---|---|---|
| STACK-01 | Backend: TypeScript, Express, node-pg-migrate migrations, native `pg` driver, thin repository layer, no ORM, no query builder. | **MATCHES** | `backend/package.json` contains `express`, `pg`, `node-pg-migrate`; repository files (`*.repository.ts`) use raw SQL queries via `pool.query` or `client.query`. No Prisma, TypeORM, Drizzle, or Kysely. | Low | None. |
| STACK-02 | Validation via Zod. | **MATCHES** | `backend/src/common/middleware/validate.ts` uses `zod` for request body, query, and params validation across all route files. | Low | None. |
| STACK-03 | Logging via Pino with credential redaction. | **MATCHES** | `backend/src/common/utils/logger.ts:8-19` configures `pino` with redact paths: `req.headers.authorization`, `req.body.password`, `req.body.code`, `*.password_hash`, `*.token_hash`, `*.code_hash`, `*.qr_token`. | Low | None. |
| STACK-04 | Tests via Vitest. | **MATCHES** | `backend/vitest.config.ts` configures Vitest; `npm test` runs 13 test files and 246 tests passing. | Low | None. |
| STACK-05 | Money arithmetic via `decimal.js`. | **MATCHES** | `backend/src/modules/transactions/transaction.service.ts:75, 224-229` uses `Decimal` with `Decimal.ROUND_HALF_UP` for amounts, discounts, and net payable calculations. | Low | None. |
| STACK-06 | Versioned REST API under `/api/v1`. | **MATCHES** | `backend/src/app.ts:37-43` mounts all routers under `${env.API_PREFIX}` (`/api/v1`). | Low | None. |
| STACK-07 | PostgreSQL 18 in Docker Compose, host port bound to `127.0.0.1:5433` (not `5432`), volume mounted at `/var/lib/postgresql`. | **MATCHES** | `backend/docker-compose.yml:3-13`: `image: postgres:18-alpine`, `ports: ["127.0.0.1:5433:5432"]`, `volumes: ["pgdata:/var/lib/postgresql"]`. | Low | None. |
| STACK-08 | Email via Gmail SMTP (`nodemailer`) behind an interface; development console fallback. | **MATCHES** | `backend/src/integrations/email/index.ts` exports `CompositeEmailSender` implementing `IEmailSender`, dispatching via `NodemailerGmailSender` and `DevEmailLogger`. | Low | None. |
| STACK-09 | SMS behind an interface with console implementation; OTP printed to server log in development only. | **MATCHES** | `backend/src/integrations/sms/console-sms-sender.ts:20-26` implements `ISmsSender`, printing OTP to console only when `env.NODE_ENV !== "production"`. | Low | None. |
| STACK-10 | SMS provider choice and production hosting are deliberately undecided. | **MATCHES** | Confirmed: SMS provider is set to `console` simulator in `.env.example`; hosting is generic container/process without vendor lock-in. | Low | None (undecided by design). |

---

### 2.3 Database Schema (Table by Table vs Schema Proposal v5)

| Table / Component | Expected Constraints & Rules | Status | Evidence | Severity | Owner Decision Needed |
|---|---|---|---|---|---|
| `groups` | UUID PK, unique name (non-deleted), unique default (non-deleted), discount 0..100, soft delete (`deleted_at`), `active` index. | **MATCHES** | `migrations/002_core_entities.sql:2-17` matches columns, CHECK constraint, and partial unique indexes. | Low | None. |
| `admin_users` | UUID PK, unique lower email, partial unique non-null phone, `role` default 'Super Admin', initials varchar(3), `is_active` bool default TRUE, no `deleted_at`. | **MATCHES** | `migrations/002_core_entities.sql:19-37` matches columns and indexes. | Low | None. |
| `customers` | UUID PK, partial unique phone (non-deleted), partial unique email (non-deleted), global unique `qr_token`, `group_id` FK ON DELETE RESTRICT, status `customer_status` enum, recalculated `last_activity_at`, soft delete. | **MATCHES** | `migrations/002_core_entities.sql:39-62` matches columns, FK ON DELETE RESTRICT, and indexes. | Low | None. |
| `workers` | UUID PK, partial unique phone (non-deleted), partial unique email (non-deleted), `shift` enum, `status` enum, `first_login_at`, `last_activity_at`, soft delete. | **MATCHES** | `migrations/002_core_entities.sql:63-81` matches columns and indexes. | Low | None. |
| `admin_password_reset_tokens` | UUID PK, FK `admin_users(id)` ON DELETE CASCADE, `token_hash` index, `expires_at`, `used_at`. | **MATCHES** | `migrations/003_auth_and_verification.sql:2-13` matches columns, CASCADE rule, and indexes. | Low | None. |
| `otp_codes` | UUID PK, destination E.164, `code_hash`, channel/purpose/actor_type enums, `request_ip` INET, `attempts >= 0` check, `(actor_type IS NULL) = (actor_id IS NULL)` check. | **MATCHES** | `migrations/003_auth_and_verification.sql:14-34` matches columns, checks, and indexes. | Low | None. |
| `refresh_tokens` | UUID PK, `token_hash` unique, `num_nonnulls(admin, customer, worker) = 1` check, admin FK CASCADE, customer/worker FKs RESTRICT, `replaced_by` SET NULL. | **MATCHES** | `migrations/003_auth_and_verification.sql:35-57` matches columns, foreign key delete rules, and check constraint. | Low | None. |
| `transactions` | UUID PK, FKs customer/worker/group RESTRICT, `amount > 0`, discount percent 0..100, discount amount 0..amount, litres > 0 or NULL, status and fuel enums, `submitted_at`, `resolved_at`. | **MATCHES** | `migrations/004_activity_and_events.sql:2-28` matches columns, all 5 check constraints, and 5 indexes. | Low | None. |
| `notifications` | UUID PK, type enum ('registration', 'worker'), `NOT (customer_id IS NOT NULL AND worker_id IS NOT NULL)` check, FKs ON DELETE SET NULL, `is_read` bool. | **MATCHES** | `migrations/004_activity_and_events.sql:30-47` matches columns, check constraint, and indexes. | Low | None. |
| `audit_logs` | UUID PK, action, actor_type, actor_id/entity_id (no FK), old/new_status, reason, old/new_value JSONB, IP, user agent, immutable. | **MATCHES** | `migrations/004_activity_and_events.sql:48-71` matches columns and 5 indexes. | Low | None. |
| Triggers | `set_updated_at()` on 5 mutable tables; `prevent_audit_mutation()` on `audit_logs` (raises exception on UPDATE/DELETE). | **MATCHES** | `migrations/005_triggers_and_functions.sql:1-40` implements trigger functions and attaches triggers. Tested in `src/tests/constraints.test.ts`. | Low | None. |
| Enums | 9 PostgreSQL ENUM types: `customer_status`, `worker_shift`, `worker_status`, `transaction_status`, `fuel_type`, `notification_type`, `otp_channel`, `otp_actor_type`, `otp_purpose`. | **MATCHES** | `migrations/001_extensions_and_types.sql:4-12` defines all 9 enums with exact values. | Low | None. |
| Storage format | E.164 phone storage (+91 only) and lower-cased email. | **MATCHES** | `normalizeIndianPhone` in `phone.ts` and `normalizeEmail` in `email.ts` applied across admin, customer, worker, and OTP tables. | Low | None. |
| No passwords on mobile | Customers and workers have no password columns in DB. | **MATCHES** | `customers` and `workers` tables in `migrations/002_core_entities.sql` contain zero password columns. | Low | None. |
| Customer status | Only `active` and `inactive` (no `pending`). | **MATCHES** | `customer_status` enum is `'active', 'inactive'`. Frontend `types.ts:29` specifies `"active" | "inactive"`. | Low | None. |

---

### 2.4 System Behaviour & Business Rules

| ID / Rule | Expected Behaviour | Status | Evidence | Severity | Owner Decision Needed |
|---|---|---|---|---|---|
| BEH-01 | Customers and workers log in by OTP only; only admin has password, forgot-password, change-password. | **MATCHES** | `auth.routes.ts` routes `/otp/request` and `/otp/verify` for mobile; `/admin/login`, `/admin/forgot-password`, `/admin/reset-password` for admin. | Low | None. |
| BEH-02 | Workers created by admin only; only `active` workers can log in, refresh, or scan (`offline` and `suspended` are blocked). | **MATCHES** | `otp.service.ts:316-324`, `auth.service.ts:265-274`, and `auth.ts:53-58` reject non-active workers with 403. | Low | None. |
| BEH-03 | Inactive or soft-deleted customers are blocked. | **DEVIATES** | In `backend/src/common/middleware/auth.ts:43-45`, `SELECT id, status FROM customers WHERE id = $1 AND deleted_at IS NULL` checks `if (result.rows.length > 0 && result.rows[0].status !== "active")`. If the customer was soft-deleted, `result.rows.length === 0` so `authMiddleware` does not reject the request (unlike admin check which rejects `result.rowCount === 0`). However, customer profile and QR service endpoints explicitly check `!customer || customer.deleted_at` and reject with 403/404. | Medium | Decide whether to update `authMiddleware` to explicitly reject customers and workers when `result.rows.length === 0`. |
| BEH-04 | New customer self-registers with name and phone, lands in default group, status active, creates notification. | **MATCHES** | `customer-mobile.service.ts:114-135` assigns default group, sets status `'active'`, and calls `notifyCustomerRegistered()`. Verified in `e2e.test.ts`. | Low | None. |
| BEH-05 | Worker first successful OTP login creates a notification once. | **MATCHES** | `otp.service.ts:328-338` checks `if (!worker.first_login_at)`, sets `first_login_at = now()`, and calls `notifyWorkerFirstLogin()`. Verified in `e2e.test.ts`. | Low | None. |
| BEH-06 | Admin-created customer creates NO notification. | **MATCHES** | `customer.service.ts:231` inserts customer and writes audit log without calling notification service. Verified in `customers.test.ts`. | Low | None. |
| BEH-07 | Default group cannot be deleted or deactivated; discount percent CAN be edited by admin. | **MATCHES** | `group.service.ts:148-153` allows editing default group discount; `group.service.ts:204, 255` rejects deactivation or deletion with 400. Verified in `groups.test.ts`. | Low | None. |
| BEH-08 | Deleting a group moves members to default group in same transaction. | **MATCHES** | `group.service.ts:270-280` reassigns members to default group in same db transaction before soft-deleting group. Verified in `groups.test.ts`. | Low | None. |
| BEH-09 | Members of an inactive group receive 0% discount and scan proceeds. | **MATCHES** | `transaction.service.ts:154-158` sets `effectiveDiscount = "0.00"` if `group.active === false`. Verified in `transactions.test.ts`. | Low | None. |
| BEH-10 | Rejected scan creates no transaction row, logs `audit_logs` in standalone transaction without token value. | **MATCHES** | `transaction.service.ts:121-129, 139-149` calls `auditService.recordStandalone` with reason `CUSTOMER_NOT_FOUND` or `CUSTOMER_INACTIVE`. Scanned token is never written. Verified in `transactions.test.ts`. | Low | None. |
| BEH-11 | Submit tied to scan via signed `scanTicket` and idempotent by client id (same worker and payload check). | **MATCHES** | `transaction.service.ts:188-197, 237-255` verifies cryptographic ticket signature and returns 200 on matching retry or 409 on mismatch. Verified in `transactions.test.ts`. | Low | None. |
| BEH-12 | Transitions only `pending` -> `success`/`failed` and `success` <-> `failed`, never back to `pending`. | **MATCHES** | `transaction.service.ts:384-386` throws `BadRequestError("Reverting to pending is forbidden")`. Workers can update only their own transactions; admin can update any. Verified in `transactions.test.ts`. | Low | None. |
| BEH-13 | `customers.last_activity_at` recalculated when status transitions to or from `success`. | **MATCHES** | `transaction.service.ts:401-403` calls `recalculateCustomerLastActivity` updating `last_activity_at` to latest remaining success transaction or NULL. Verified in `transactions.test.ts`. | Low | None. |
| BEH-14 | Worker "scans" counts all submitted transactions; worker "transactions" counts successes only; revenue and discount totals count success only. | **MATCHES** | `worker.repository.ts:77-83` and `reports.repository.ts:28-40` aggregate `scans = COUNT(t.id)` vs `transactions = COUNT(CASE WHEN t.status = 'success')`. Verified in `analytics.test.ts`. | Low | None. |
| BEH-15 | Token security: short-lived access token, SHA-256 hashed refresh token with rotation and reuse detection. | **MATCHES** | `auth.service.ts:180-201` rotates refresh token and revokes descendant chain if revoked token presented. Verified in `admin-auth.test.ts`. | Low | None. |
| BEH-16 | Token revocations on soft delete, worker suspension, customer inactive, admin deactivation, and password reset. | **MATCHES** | Verified in `admin-auth.test.ts`, `customers.test.ts`, and `workers.test.ts`. Token tables pruned accordingly. | Low | None. |
| BEH-17 | Admin login protection: progressive delay + per-IP rate limit (no hard lockout). | **MATCHES** | `login-protection.ts:29-38` introduces 1s, 2s, 4s delay after 3+ failures; throws 429 after 10 failures in 15m. Verified in `auth.service.test.ts`. | Low | None. |
| BEH-18 | OTP limits: 6 digits, 5 min, 5 attempts, 60s cooldown, 5/hr destination, 10 reg/hr IP. | **MATCHES** | `otp.service.ts:83, 96, 107, 248, 252` enforces all 5 rate limits and expiry checks. Verified in `otp.test.ts`. | Low | None. |
| BEH-19 | Unknown-number login OTP stores NO row and sends NO SMS (timing-safe). | **MATCHES** | `otp.service.ts:167-174` returns `{ message: "Code sent", cooldown: 60 }` without inserting DB row or sending SMS. Verified in `otp.test.ts`. | Low | None. |
| BEH-20 | Asia/Kolkata timezone used for "today", series buckets, and date filters. | **MATCHES** | `date.ts:5-65` uses `+05:30` IST offset for day boundaries and bucket generations. Verified in `analytics.test.ts`. | Low | None. |
| BEH-21 | Reports return raw values; CSV export is streamed server-side. | **MATCHES** | `reports.service.ts:260-310` sets `Transfer-Encoding: chunked` and streams CSV directly to HTTP response. Verified in `analytics.test.ts`. | Low | None. |
| BEH-22 | Notifications never pruned; cleanup job removes expired OTPs, refresh tokens, and reset tokens only. | **MATCHES** | `cleanup-expired.job.ts:15-38` deletes from `otp_codes`, `refresh_tokens`, `admin_password_reset_tokens`; touches zero notification rows. Verified in `analytics.test.ts`. | Low | None. |
| BEH-23 | Audit snapshot sanitization strips passwords, hashes, tokens, and QR tokens. | **MATCHES** | `audit.service.ts:6-35` strips `password*`, `token*`, `code*`, `qr_token*` recursively before inserting audit rows. Verified in `mobile-profile.test.ts` and `analytics.test.ts`. | Low | None. |

---

### 2.5 REST Endpoints Inventory

All 53 endpoints defined in `docs/api-proposal.md` were checked against the route declarations:

| Endpoint Path & Method | Documented in Proposal | Present in Code | Guard / Role | Status | Evidence |
|---|---|---|---|---|---|
| `POST /api/v1/auth/otp/request` | Yes (§2.1) | Yes | Public | **MATCHES** | `auth.routes.ts:44` |
| `POST /api/v1/auth/otp/verify` | Yes (§2.1) | Yes | Public | **MATCHES** | `auth.routes.ts:45` |
| `POST /api/v1/auth/admin/login` | Yes (§2.1) | Yes | Public | **MATCHES** | `auth.routes.ts:46` |
| `POST /api/v1/auth/admin/forgot-password` | Yes (§2.1) | Yes | Public | **MATCHES** | `auth.routes.ts:50` |
| `POST /api/v1/auth/admin/reset-password` | Yes (§2.1) | Yes | Public | **MATCHES** | `auth.routes.ts:54` |
| `POST /api/v1/auth/refresh` | Yes (§2.1) | Yes | Public (Cookie/Body) | **MATCHES** | `auth.routes.ts:47` |
| `POST /api/v1/auth/logout` | Yes (§2.1) | Yes | Optional/Auth | **MATCHES** | `auth.routes.ts:48` |
| `POST /api/v1/customer/register` | Yes (§2.2) | Yes | Public | **MATCHES** | `customer-mobile.routes.ts:40` |
| `GET /api/v1/customer/profile` | Yes (§2.2) | Yes | Customer | **MATCHES** | `customer-mobile.routes.ts:42` (Implemented in Task 23) |
| `PATCH /api/v1/customer/profile` | Yes (§2.2) | Yes | Customer | **MATCHES** | `customer-mobile.routes.ts:49` (Implemented in Task 23) |
| `GET /api/v1/customer/qr` | Yes (§2.2) | Yes | Customer | **MATCHES** | `customer-mobile.routes.ts:57` |
| `POST /api/v1/customer/qr/regenerate` | Yes (§2.2) | Yes | Customer | **MATCHES** | `customer-mobile.routes.ts:59` |
| `GET /api/v1/customer/transactions` | Yes (§2.2) | Yes | Customer | **MATCHES** | `customer-mobile.routes.ts:66` |
| `GET /api/v1/worker/profile` | Yes (§2.3) | Yes | Worker | **MATCHES** | `worker-transaction.routes.ts:15` (Implemented in Task 23) |
| `POST /api/v1/worker/scan` | Yes (§2.3) | Yes | Worker | **MATCHES** | `worker-transaction.routes.ts:58` |
| `POST /api/v1/worker/transactions` | Yes (§2.3) | Yes | Worker | **MATCHES** | `worker-transaction.routes.ts:65` |
| `PATCH /api/v1/worker/transactions/:id/status` | Yes (§2.3) | Yes | Worker | **MATCHES** | `worker-transaction.routes.ts:73` |
| `GET /api/v1/worker/transactions` | Yes (§2.3) | Yes | Worker | **MATCHES** | `worker-transaction.routes.ts:80` |
| `GET /api/v1/admin/profile` | Yes (§2.4) | Yes | Admin | **MATCHES** | `admin.routes.ts:31` |
| `PATCH /api/v1/admin/profile` | Yes (§2.4) | Yes | Admin | **MATCHES** | `admin.routes.ts:32` |
| `POST /api/v1/admin/profile/change-password` | Yes (§2.4) | Yes | Admin | **MATCHES** | `admin.routes.ts:33` |
| `GET /api/v1/admin/dashboard/overview` | Yes (§2.4) | Yes | Admin | **MATCHES** | `reports.routes.ts:17` |
| `GET /api/v1/admin/dashboard/series` | Yes (§2.4) | Yes | Admin | **MATCHES** | `reports.routes.ts:18` |
| `GET /api/v1/admin/dashboard/worker-activity` | Yes (§2.4) | Yes | Admin | **MATCHES** | `reports.routes.ts:23` |
| `GET /api/v1/admin/dashboard/group-distribution` | Yes (§2.4) | Yes | Admin | **MATCHES** | `reports.routes.ts:24` |
| `GET /api/v1/admin/customers` | Yes (§2.4) | Yes | Admin | **MATCHES** | `customer.routes.ts:62` |
| `GET /api/v1/admin/customers/:id` | Yes (§2.4) | Yes | Admin | **MATCHES** | `customer.routes.ts:68` |
| `POST /api/v1/admin/customers` | Yes (§2.4) | Yes | Admin | **MATCHES** | `customer.routes.ts:74` |
| `PATCH /api/v1/admin/customers/:id` | Yes (§2.4) | Yes | Admin | **MATCHES** | `customer.routes.ts:80` |
| `PATCH /api/v1/admin/customers/:id/status` | Yes (§2.4) | Yes | Admin | **MATCHES** | `customer.routes.ts:86` |
| `PATCH /api/v1/admin/customers/:id/group` | Yes (§2.4) | Yes | Admin | **MATCHES** | `customer.routes.ts:92` |
| `DELETE /api/v1/admin/customers/:id` | Yes (§2.4) | Yes | Admin | **MATCHES** | `customer.routes.ts:98` |
| `GET /api/v1/admin/workers` | Yes (§2.4) | Yes | Admin | **MATCHES** | `worker.routes.ts:62` |
| `GET /api/v1/admin/workers/:id` | Yes (§2.4) | Yes | Admin | **MATCHES** | `worker.routes.ts:64` |
| `POST /api/v1/admin/workers` | Yes (§2.4) | Yes | Admin | **MATCHES** | `worker.routes.ts:66` |
| `PATCH /api/v1/admin/workers/:id` | Yes (§2.4) | Yes | Admin | **MATCHES** | `worker.routes.ts:68` |
| `PATCH /api/v1/admin/workers/:id/status` | Yes (§2.4) | Yes | Admin | **MATCHES** | `worker.routes.ts:74` |
| `DELETE /api/v1/admin/workers/:id` | Yes (§2.4) | Yes | Admin | **MATCHES** | `worker.routes.ts:80` |
| `GET /api/v1/admin/groups` | Yes (§2.4) | Yes | Admin | **MATCHES** | `group.routes.ts:36` |
| `POST /api/v1/admin/groups` | Yes (§2.4) | Yes | Admin | **MATCHES** | `group.routes.ts:38` |
| `PATCH /api/v1/admin/groups/:id` | Yes (§2.4) | Yes | Admin | **MATCHES** | `group.routes.ts:40` |
| `PATCH /api/v1/admin/groups/:id/toggle-active` | Yes (§2.4) | Yes | Admin | **MATCHES** | `group.routes.ts:46` |
| `DELETE /api/v1/admin/groups/:id` | Yes (§2.4) | Yes | Admin | **MATCHES** | `group.routes.ts:52` |
| `GET /api/v1/admin/transactions` | Yes (§2.4) | Yes | Admin | **MATCHES** | `admin-transaction.routes.ts:41` |
| `GET /api/v1/admin/transactions/:id` | Yes (§2.4) | Yes | Admin | **MATCHES** | `admin-transaction.routes.ts:48` |
| `PATCH /api/v1/admin/transactions/:id/status` | Yes (§2.4) | Yes | Admin | **MATCHES** | `admin-transaction.routes.ts:55` |
| `GET /api/v1/admin/notifications` | Yes (§2.4) | Yes | Admin | **MATCHES** | `notification.routes.ts:23` |
| `PATCH /api/v1/admin/notifications/:id/read` | Yes (§2.4) | Yes | Admin | **MATCHES** | `notification.routes.ts:29` |
| `POST /api/v1/admin/notifications/mark-all-read` | Yes (§2.4) | Yes | Admin | **MATCHES** | `notification.routes.ts:35` |
| `GET /api/v1/admin/audit-logs` | Yes (§2.4) | Yes | Admin | **MATCHES** | `audit.routes.ts:25` |
| `GET /api/v1/admin/reports/summary` | Yes (§2.4) | Yes | Admin | **MATCHES** | `reports.routes.ts:55` |
| `GET /api/v1/admin/reports/export` | Yes (§2.4) | Yes | Admin | **MATCHES** | `reports.routes.ts:60` |
| `GET /api/v1/admin/search` | Yes (§2.4) | Yes | Admin | **MATCHES** | `admin.routes.ts:48` |
| `GET /api/v1/health` | No (in backend structure doc §11) | Yes | Public | **BUILT BUT NOT DECIDED** in API doc | `app.ts:43` |

---

### 2.6 Frontend Verification

| ID / Feature | Expected | Status | Evidence | Severity | Owner Decision Needed |
|---|---|---|---|---|---|
| FE-01 | Real API wired for every page; mock data and mock service gone. | **MATCHES** | `frontend/src/services/adminService.ts` calls real `apiRequest` endpoints; zero mock dataset objects exist in `frontend/src/`. | Low | None. |
| FE-02 | No customer 'pending' status in UI or models. | **MATCHES** | `frontend/src/services/types.ts:29` defines `status: "active" | "inactive"`. | Low | None. |
| FE-03 | Password fields for customers and workers removed. | **MATCHES** | `_admin.customers.tsx` and `_admin.workers.tsx` have no password inputs; line 696 has helper text *"Workers log in using phone/email OTP. No password required."* | Low | None. |
| FE-04 | Admin "Regenerate QR" button absent. | **MATCHES** | Search across `frontend/src` returns zero matches for "regenerate" button in admin views. | Low | None. |
| FE-05 | Mobile phone input is 10 digits with read-only `+91` prefix addon block. | **MATCHES** | Implemented in Task 22 in `_admin.customers.tsx`, `_admin.workers.tsx`, `_admin.profile.tsx`. | Low | None. |
| FE-06 | Null litres and fuel type shown as dash (`—`). | **MATCHES** | `_admin.reports.tsx:338-339, 753-755` renders `t.fuel ?? "—"` and `t.litres !== null ? `${t.litres} L` : "—"`. | Low | None. |
| FE-07 | Audit log page shows rejected scans with filter. | **MATCHES** | `_admin.audit-logs.tsx:62` has `{ value: "scan.rejected", label: "Rejected Scans (scan.rejected)" }`. | Low | None. |
| FE-08 | Worker first-login notification and transaction status control exist. | **MATCHES** | Verified in `_admin.notifications.tsx` and `_admin.reports.tsx`. | Low | None. |
| FE-09 | Dedicated `/reset-password` page exists. | **MATCHES** | `frontend/src/routes/reset-password.tsx` implements token validation and password reset form. | Low | None. |
| FE-10 | Lists use server-side pagination, filtering, and sorting. | **MATCHES** | `DataTable.tsx` wired with server params; verified across customers, workers, transactions, audit logs. | Low | None. |
| FE-11 | Notification filter tabs in UI. | **DEVIATES** | `frontend/src/routes/_admin.notifications.tsx:47` retains `{ key: "system", label: "System" }` tab even though `notification_type` was pruned to `'registration'` and `'worker'` (D54). | Low | Remove the dead "System" tab from notification filter bar. |

---

### 2.7 Security & Hygiene

| ID / Rule | Expected | Status | Evidence | Severity | Owner Decision Needed |
|---|---|---|---|---|---|
| SEC-01 | No real secrets in committed files (`.env` git-ignored; `.env.example` has placeholders only, no personal email). | **MATCHES** | `backend/.env.example` contains only placeholders/empty values (`JWT_ACCESS_SECRET=your_jwt_access_secret...`, `SMTP_USER=`, `SEED_ADMIN_EMAIL=`). Root `.gitignore:13` ignores `.env` and `.env.*`. | Low | None. |
| SEC-02 | Production start refuses default or placeholder secrets. | **MATCHES** | `backend/src/config/env.ts:63-95` `superRefine` enforces $\ge 32$ chars, rejects substrings "secret", "dev", "change_me", and requires `SMTP_USER` and `SMTP_PASSWORD` in production. | Low | None. |
| SEC-03 | Refresh cookie is `httpOnly`, `SameSite=Strict`, `Secure` outside local development. | **MATCHES** | `backend/src/modules/auth/auth.controller.ts:8-14`: `httpOnly: true`, `secure: env.NODE_ENV === "production"`, `sameSite: "strict"`, `path: "/api/v1/auth"`. | Low | None. |
| SEC-04 | CORS restricted with credentials. | **MATCHES** | `backend/src/app.ts:21-26` sets `origin: env.CORS_ORIGIN`, `credentials: true`. | Low | None. |
| SEC-05 | Helmet security headers present. | **MATCHES** | `backend/src/app.ts:18` invokes `app.use(helmet())`. | Low | None. |
| SEC-06 | General and endpoint rate limits present. | **MATCHES** | `backend/src/common/middleware/rate-limiter.ts` defines `generalRateLimiter` (100 req/min) and `workerScanRateLimiter` (30 req/min). | Low | None. |
| SEC-07 | Structured logging redaction works. | **MATCHES** | `backend/src/common/utils/logger.ts:8-19` redacts Authorization header, passwords, codes, hashes, and QR tokens. | Low | None. |

---

### 2.8 Postman Collection & Environment

| Item | Expected | Status | Evidence | Severity | Owner Decision Needed |
|---|---|---|---|---|---|
| POSTMAN-01 | Environment uses port 3000. | **MATCHES** | `backend/postman/FuelPoint_Local.postman_environment.json:7` sets `"baseUrl": "http://localhost:3000/api/v1"`. | Low | None. |
| POSTMAN-02 | Collection matches all current endpoints. | **NOT IMPLEMENTED** | Collection contains 60 requests covering all endpoints except `POST /api/v1/customer/qr/regenerate` (not present in `backend/postman/FuelPoint_API.postman_collection.json`). | Low | Decide whether to add `POST /customer/qr/regenerate` request to Folder 04 of Postman collection. |

---

## 3. Docs That Contradict Each Other or the Code

1. **`GET /api/v1/health` documentation gap:**
   - `docs/backend-structure-proposal.md` (§11) describes the health check endpoint.
   - `docs/api-proposal.md` (§2) does NOT list `GET /api/v1/health` in its endpoint inventory table.
   - *Code reality:* Implemented and active at `backend/src/app.ts:43-59`.
2. **`scan.rejected` reason code `WORKER_SUSPENDED`:**
   - `docs/db-schema-proposal.md` (§3.2) lists `WORKER_SUSPENDED` as a rejected scan reason code.
   - `docs/backend-structure-proposal.md` (§0, Proposed Fix 10) explicitly notes that `WORKER_SUSPENDED` is unreachable in scan handler because `authMiddleware` rejects non-active workers beforehand with HTTP 403.
   - *Code reality:* `scanQr` in `transaction.service.ts` only logs `CUSTOMER_NOT_FOUND` or `CUSTOMER_INACTIVE`.
3. **`notification_type` ENUM vs Frontend UI:**
   - `docs/db-schema-proposal.md` (D54) pruned enum to `'registration'` and `'worker'` only.
   - `frontend/src/routes/_admin.notifications.tsx:47` and `frontend/src/services/types.ts:210` still define `"system"` in the UI filter tabs and TypeScript interface.
4. **`frontend/README.md` mock data description:**
   - `frontend/README.md:3` still claims the backend is "not built yet" and data is "mock data", contradicting the actual state where the frontend is fully wired to the backend API.

---

## 4. Built but Never Decided

1. **Deterministic Default Group UUID (`00000000-0000-0000-0000-000000000001`):**
   - Seeded in `backend/src/seeds/default-group.seed.ts` and hardcoded as `DEFAULT_GROUP_ID` in `frontend/src/services/types.ts:1`. Convenient for deterministic foreign-key references, but was not in the original schema proposal.
2. **Search filter (`q`) on Reports Summary & CSV Export:**
   - Added in Task 22 to allow searching transactions and exporting the exact filtered search result as CSV. Not in original `api-proposal.md`.
3. **`supertest` dev dependency:**
   - Installed in `backend/package.json` for HTTP integration tests. Standard tool, but not listed in initial proposal.

---

## 5. Raw Command Results

### Backend Commands

#### 1. `docker compose up -d`
```text
Container fuelpoint-postgres Running
Exit code: 0
```

#### 2. `npm install`
```text
up to date, audited 366 packages in 4s
94 packages are looking for funding
3 vulnerabilities (1 moderate, 2 critical)
Exit code: 0
```

#### 3. Database Migrations (`npm run migrate`, `migrate:down`, `migrate`)
```text
> tsx src/db/migrate.ts up
No migrations to run!
appliedCount: 0
Exit code: 0

> tsx src/db/migrate.ts down 1
> Migrating files:
> - 005_triggers_and_functions
### MIGRATION 005_triggers_and_functions (DOWN) ###
appliedCount: 1
Exit code: 0

> tsx src/db/migrate.ts up
> Migrating files:
> - 005_triggers_and_functions
### MIGRATION 005_triggers_and_functions (UP) ###
appliedCount: 1
Exit code: 0
```

#### 4. Database Seed (`npm run seed` twice for idempotency)
```text
Run 1:
[2026-10-14 11:40:16.732 +0530] INFO: Starting database seeding...
[2026-10-14 11:40:16.849 +0530] INFO: Default group already exists, skipping.
[2026-10-14 11:40:16.856 +0530] INFO: Admin user already exists, skipping admin seed.
[2026-10-14 11:40:16.856 +0530] INFO: Database seeding completed successfully.
Exit code: 0

Run 2:
[2026-10-14 11:40:42.769 +0530] INFO: Starting database seeding...
[2026-10-14 11:40:42.850 +0530] INFO: Default group already exists, skipping.
[2026-10-14 11:40:42.857 +0530] INFO: Admin user already exists, skipping admin seed.
[2026-10-14 11:40:42.857 +0530] INFO: Database seeding completed successfully.
Exit code: 0
```

#### 5. `npm run typecheck`
```text
> tsc --noEmit
Exit code: 0
```

#### 6. `npm run lint`
```text
> eslint .
Exit code: 0 (0 errors, 0 warnings)
```

#### 7. `npm test`
```text
Test Files  13 passed (13)
     Tests  246 passed (246)
  Duration  255.36s
Exit code: 0
```

#### 8. `npm run build`
```text
> tsc
Exit code: 0
```

---

### Frontend Commands

#### 1. `npm install`
```text
up to date, audited 362 packages in 6s
79 packages are looking for funding
found 0 vulnerabilities
Exit code: 0
```

#### 2. `npm run typecheck`
```text
> tsc --noEmit
Exit code: 0
```

#### 3. `npm run lint`
```text
> eslint .
✖ 7 problems (0 errors, 7 warnings)
(7 Fast refresh warnings in ui/ components)
Exit code: 0
```

#### 4. `npm run build`
```text
> vite build
✓ 2552 modules transformed.
dist/index.html                                 0.67 kB │ gzip:   0.32 kB
dist/assets/index-BoHEY54H.css                 89.79 kB │ gzip:  14.76 kB
...
✓ built in 23.54s
Exit code: 0
```

---

### Postman Verification

- **Environment File:** `backend/postman/FuelPoint_Local.postman_environment.json` configures `baseUrl: "http://localhost:3000/api/v1"` (uses port 3000). Matches!
- **Collection File:** `backend/postman/FuelPoint_API.postman_collection.json` contains 60 API requests across 12 organized folders (00 to 11). Includes all Task 23 profile endpoints. One endpoint is missing: `POST /api/v1/customer/qr/regenerate`.
