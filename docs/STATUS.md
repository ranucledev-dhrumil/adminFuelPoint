# FuelStationAdmin — Task Status Log

## Task 0: Baseline Check (Restore, Run, Report)

**Date:** 2026-10-09  
**Branch:** newChanges

---

### 1. Git Status (before restore)

`git status` showed the following changes not staged for commit:

**Deleted (target files to restore):**
- `src/lib/error-capture.ts`
- `src/lib/lovable-error-reporting.ts`
- `src/server.ts`
- `src/start.ts`

**Modified (also restored — required for app to work):**
- `package.json` — was missing `@tanstack/react-start`, `@lovable.dev/vite-tanstack-config`, and `nitro`
- `src/routes/__root.tsx` — was missing `import { reportLovableError } from "../lib/lovable-error-reporting"` (used in `ErrorComponent`)

**Left deleted (intentional, per task instructions):**
- `.lovable/project.json`, `AGENTS.md`, `FuelStationAdmin.rar`, `FuelStationAdmin.zip`
- `bun.lock`, `bunfig.toml`, `check_oklch.js`
- `cleanup_vars.py`, `extract_colors.py`, `extract_dominant.py`, `hex2oklch.py`
- `nayaraenergy.com-design.md`, `remove_graphs.py`, `rewrite_css.py`
- `src/routes/README.md`, `tweak_profile.py`, `update_charts.py`, `update_reports.py`

> Note: `src/lib/error-page.ts` was listed in the task but was **already present** (not deleted). No action needed.

---

### 2. Files Restored

Restored via `git restore`:

| File | Reason |
|---|---|
| `src/lib/lovable-error-reporting.ts` | Deleted — used by `__root.tsx` `ErrorComponent` |
| `src/server.ts` | Deleted — SSR server entry used by `vite.config.ts` |
| `src/start.ts` | Deleted — TanStack Start instance, referenced by `routeTree.gen.ts` |
| `src/lib/error-capture.ts` | Deleted — error capture utility |
| `package.json` | Modified — missing `@tanstack/react-start@1.168.32`, `@lovable.dev/vite-tanstack-config@^2.24.0`, `nitro@3.0.260603-beta` |
| `src/routes/__root.tsx` | Modified — missing `import { reportLovableError }` import causing TS error |

---

### 3. npm install

```
cmd /c "npm install"
```

**Result:** ✅ Success — exit code 0

```
up to date, audited 421 packages in 3s
99 packages are looking for funding
2 vulnerabilities (1 high, 1 critical)
```

Key packages confirmed installed:
- `@lovable.dev/vite-tanstack-config@2.25.0`
- `@tanstack/react-start@1.168.32`
- `nitro@3.0.260603-beta`

---

### 4. npm run dev — Route Check

Dev server started on **http://localhost:8080** (not 3000).  
Start-up log:

```
VITE v8.1.5  ready in 34298 ms
➜  Local:   http://localhost:8080/
➜  Network: http://192.168.1.22:8080/
```

One informational note (not an error):
```
The plugin "vite-tsconfig-paths" is detected. Vite now supports tsconfig paths resolution
natively via the resolve.tsconfigPaths option. You can remove the plugin and set
resolve.tsconfigPaths: true in your Vite config instead.
```

**Route results (HTTP HEAD requests):**

| Route | Status | Notes |
|---|---|---|
| `/` | 200 ✅ | FuelPoint Admin login page — full SSR HTML confirmed |
| `/dashboard` | 200 ✅ | |
| `/workers` | 200 ✅ | |
| `/customers` | 200 ✅ | |
| `/groups` | 200 ✅ | |
| `/notifications` | 200 ✅ | |
| `/reports` | 200 ✅ | |
| `/profile` | 200 ✅ | |
| `/search` | 307 ✅ | Redirects to `/search?q=` — expected behavior |

**No console errors observed in dev server log.**

---

### 5. npm run build

```
cmd /c "npm run build 2>&1"
```

**Result:** ✅ Success — exit code 0

```
✓ built in 2.07s
[nitro] i Using auto generated worker name: ranucledev-dhrumil-fuelpoint
i Generated .output/server/wrangler.json
i Generated .wrangler/deploy/config.json
i Generated .output/public/_headers
i Generated .output/nitro.json

[nitro] √ You can preview this build using npx vite preview
[nitro] √ You can deploy this build using npx nitro deploy --prebuilt
```

Build generated `.output/` (client + server bundles) and `.wrangler/` deploy config.

---

### 6. Fixes Made

| Fix | File | Reason |
|---|---|---|
| Restored deleted file | `src/lib/lovable-error-reporting.ts` | Required by `__root.tsx` |
| Restored deleted file | `src/server.ts` | Required by `vite.config.ts` as SSR server entry |
| Restored deleted file | `src/start.ts` | Required by `routeTree.gen.ts` |
| Restored deleted file | `src/lib/error-capture.ts` | Error capture utility used by `server.ts` |
| Restored modified file | `package.json` | Missing `@tanstack/react-start`, `@lovable.dev/vite-tanstack-config`, `nitro` |
| Restored modified file | `src/routes/__root.tsx` | Missing `reportLovableError` import (referenced in ErrorComponent) |

No code was written or refactored. All fixes were `git restore` operations only.

---

### 7. Errors Encountered

None. All steps completed successfully on first attempt after restoring files.

---

**Next: awaiting orchestrator instructions.**


---

## Task 1: Restructure + SPA migration (done by the orchestrator, Claude)

**Date:** 2026-10-12

### What changed
- New layout: git root `adminFuelPoint/` containing `frontend/`, `backend/` (README only), `docs/` (this file). `.git` kept at the root so history is preserved.
- Pure SPA (option A): TanStack Router kept; TanStack Start, Nitro and the Lovable Vite wrapper removed. New `index.html`, `src/main.tsx`; plain `vite.config.ts` (router plugin, React, Tailwind, native `resolve.tsconfigPaths`).
- Deleted: `src/server.ts`, `src/start.ts`, `src/lib/error-capture.ts`, `src/lib/error-page.ts`, `src/lib/lovable-error-reporting.ts`, old README. Removed packages: `@tanstack/react-start`, `nitro`, `@lovable.dev/vite-tanstack-config`, `vite-tsconfig-paths`.
- `__root.tsx`: no longer renders the HTML shell; Lovable error reporting removed; `<HeadContent />` kept so per-route titles still work; `styles.css` is now imported in `main.tsx`.
- `package.json`: renamed `adminfuelpoint-frontend`; scripts are `dev`, `build`, `preview`, `typecheck`, `lint`, `format` (the old `build:dev` script was removed). `package-lock.json` regenerated.
- New: root `.gitignore`, `frontend/README.md`, `backend/README.md`. `eslint.config.js` lost the TanStack-Start-only `server-only` rule; `.prettierignore` trimmed.

### Verification
- `npm install`: 0 vulnerabilities (fresh lockfile). `npm run build`: success, CSS emitted.
- Smoke test (jsdom, temporary and not included): `/`, `/dashboard`, `/workers`, `/customers`, `/groups`, `/notifications`, `/reports`, `/profile`, `/search?q=a` and the 404 page all render; per-route document titles correct.
- NOT verified: a real browser run. Please open the app once and click through every page.
- `npm run typecheck`: 9 errors, identical to the original project (AdminShell.tsx: 2, _admin.search.tsx: 7). Not caused by the migration.

### Defaults chosen (not confirmed by the user)
- Dev server port is Vite's default 5173 (the old setup used 8080).
- `index.html` has only charset and viewport; title, meta tags, Lato font link and favicon stay in the root route's `head`.
- No hosting/Amplify config added.
- Nothing committed; moves show in git as deletions plus untracked files until `git add -A`.

**Next: awaiting orchestrator instructions.**


---

## Task 2: Database Schema Proposal (analysis and documentation only)

**Date:** 2026-10-12

### What was read

| File | Purpose |
|---|---|
| `frontend/src/services/types.ts` | TypeScript interfaces: `Group`, `Customer`, `Worker`, `Transaction`, `Notification`, `AdminProfile`, `SeriesPoint` |
| `frontend/src/services/mockData.ts` | Seed data revealing field shapes, enum values, group mechanics, and computed aggregates |
| `frontend/src/services/adminService.ts` | Service layer: `Overview` type, `buildOverview`, `buildSeries`, `groupDistribution`, `workerActivity`, `rangeBounds`, `inRange`, `exportCsv` |
| `frontend/src/lib/admin-store.tsx` | Store mutations: `login`, `logout`, `assignCustomerGroup`, `saveGroup`, `deleteGroup`, `toggleGroupActive`, `saveCustomer`, `deleteCustomer`, `saveWorker`, `deleteWorker`, `markRead`, `markAllRead` |
| `frontend/src/routes/index.tsx` | Login page: email + password form, forgot-password flow |
| `frontend/src/routes/_admin.tsx` | Auth guard / layout |
| `frontend/src/routes/_admin.dashboard.tsx` | KPI stats, time-series charts, group distribution, worker activity, recent transactions |
| `frontend/src/routes/_admin.customers.tsx` | Customer list, detail, create, edit, delete, group assign, CSV export |
| `frontend/src/routes/_admin.workers.tsx` | Worker list, detail, create, edit, delete |
| `frontend/src/routes/_admin.groups.tsx` | Group list, create, edit, toggle active, delete, assign customer |
| `frontend/src/routes/_admin.notifications.tsx` | Notification list, mark read, mark all read |
| `frontend/src/routes/_admin.reports.tsx` | Tabular reports for transactions/discount/customers/workers/groups with date range + CSV export |
| `frontend/src/routes/_admin.profile.tsx` | Admin profile view and edit, password change |
| `frontend/src/routes/_admin.search.tsx` | Cross-entity search on customers and workers |
| `backend/README.md` | Confirms Node.js + PostgreSQL; framework/ORM/migration tool not yet decided |
| `docs/STATUS.md` | Prior task history |

### File created

`docs/db-schema-proposal.md` — full schema proposal including:
- Page inventory (§1): all 9 pages, their reads/writes and actions
- 7 proposed tables (§2): `admin_users`, `groups`, `customers`, `workers`, `transactions`, `notifications`, `audit_logs` — with column specs, constraints, and indexes
- Comparison with owner's list (§3): all 6 owner tables confirmed or discussed; 2 additional tables identified (`groups`, `admin_users`)
- "users" table design (§4): Design A (separate tables, recommended) vs Design B (unified users table)
- Cross-cutting decisions (§5): UUID vs bigint, TIMESTAMPTZ, NUMERIC money, PG enum, soft delete, password hashing, phone/email uniqueness, default group
- Derived values analysis (§6): all 8 aggregates — computed vs stored, with trade-offs
- `audit_logs` detail (§7): 20 auditable actions, what to log and what not to
- ER diagram in Mermaid (§8)
- 11 open questions for owner review (§9)

**Next: awaiting orchestrator instructions.**


---

## Task 3: Database Schema Proposal v2 (documentation only)

**Date:** 2026-10-12

### Files written

| File | Action |
|---|---|
| `docs/db-schema-proposal-v1.md` | Renamed from `docs/db-schema-proposal.md` (v1 preserved) |
| `docs/db-schema-proposal.md` | Created as v2 — full rewrite incorporating owner decisions |

### What was read

- `docs/db-schema-proposal.md` (v1, before rename) — prior analysis and open questions
- `docs/STATUS.md` — task history
- `frontend/src/services/types.ts` — TypeScript interfaces
- `backend/README.md` — runtime decisions and scope note

### What v2 contains

- **§0 Decision log** — 33 items marked DECIDED or PROPOSED with source
- **§1 Table overview** — 10 tables listed with purpose and justification
- **§2 Tables** — Full column specs for all 10 tables: `admin_users`, `admin_password_reset_tokens`, `groups`, `customers`, `workers`, `otp_codes`, `refresh_tokens`, `transactions`, `notifications`, `audit_logs`
- **§5 Audit log actions and rejected scan reasons** — 25 action codes; 5 proposed rejection reason codes; transaction status-change logging rules; snapshot security rule (no passwords/hashes in JSONB)
- **§6 Computed values** — all aggregates updated for `status = 'success'` filter per D23/D24
- **§7 Cross-cutting decisions** — ID type, timestamps, money, enums, soft delete, uniqueness, default group; v1 errors corrected (PG version notes for `RENAME VALUE`, `gen_random_uuid`, `INET`)
- **§8 ER diagram** — Mermaid `erDiagram` with relationship lines for all 10 tables
- **§9 Frontend changes** — 12 required changes (no code written)
- **§10 Proposed `backend/README.md` wording** — table of three clients with API scope clarification
- **§11 Open questions** — 14 items for owner

### v1 errors corrected in v2

| Error | Correction |
|---|---|
| `ALTER TYPE … RENAME VALUE` stated as PG 15 | Correct: PG 10 |
| `gen_random_uuid()` said to need `uuid-ossp` on older PG | Correct: use `pgcrypto` (`uuid_generate_v4()`); `uuid-ossp` is a different extension |
| `INET` type noted as "requires PG 9.1+" | Removed; `INET` has been available since PG 7.4 |
| `read` column on `notifications` | Renamed to `is_read` |
| Default group partial unique index did not account for soft delete | Fixed: `WHERE is_default = TRUE AND deleted_at IS NULL` |
| ER diagram had no relationship lines | Corrected; all relationships shown |
| `customers` had `status = 'pending'` | Removed per D09 |
| `customers` and `workers` had `password_hash` | Removed per D04 |

**Next: awaiting orchestrator instructions.**


---

## Task 4: Database Schema Proposal v3 (fixes + new decisions; documentation only)

**Date:** 2026-10-12

### Files written

| File | Action |
|---|---|
| `docs/db-schema-proposal-v2.md` | Renamed from `docs/db-schema-proposal.md` (v2 preserved) |
| `docs/db-schema-proposal.md` | Created as v3 |

### New decisions incorporated (D34–D49)

| Decision | Summary |
|---|---|
| D34 | Customer registration: name + phone only; email and vehicle remain optional |
| D35 | Multiple concurrent pending transactions per customer allowed |
| D36 | Notifications created for new customer and new worker registration; `worker_id` FK added to `notifications` |
| D37 | Admin may change a transaction's status; logged with `actor_type = 'admin'` |
| D38 | Inactive group = 0 % discount, scan not rejected |
| D39 | Workers created by admin only; OTP login |
| D40 | `customer.last_activity_at` = latest `success` transaction |
| D41 | `worker.last_activity_at` = latest submitted transaction (any status) |
| D42 | Default group cannot be deactivated or deleted |
| D43 | `admin_users` gains `is_active BOOLEAN`; deactivated admin tokens revoked immediately |
| D44 | Phone in E.164; email lower-cased — PROPOSED |
| D45 | `otp_codes` keyed by destination, not actor_id; supports pre-registration |
| D46 | Password-reset token expiry: 60 minutes |
| D47 | OTP: 6 digits, 5 min, 5 attempts, 60 s cooldown, 5/hr per destination |
| D48 | Refresh token expiry: 7 days (admin), 30 days (customer/worker) |
| D49 | Dashboard/report "today" uses Asia/Kolkata time |

### Fixes applied

| Fix | Description |
|---|---|
| 1 | `otp_codes` redesigned: keyed by `(channel, destination)`, no `actor_id` required; supports pre-registration |
| 2 | `QR_TOKEN_INVALID` reason code removed; old token indistinguishable from `CUSTOMER_NOT_FOUND`; token value never logged |
| 3 | `refresh_tokens` uses `ON DELETE RESTRICT` for customers/workers; explicit revocation rule documented |
| 4 | Phone stored in E.164; email lower-cased; applied to all tables and `otp_codes.destination` |
| 5 | Inactive group behaviour (D38) documented in `groups` and `transactions` sections |
| 6 | D28 and §5.1 corrected: `gen_random_uuid()` in `pgcrypto` (PG < 13); `uuid_generate_v4()` is `uuid-ossp`; INET version claim removed |
| 7 | README wording (§8) no longer attributes mobile screens to any external team |
| 8 | Placeholder sections 3 and 4 removed; sections renumbered |
| 9 | `transactions`: dropped `created_at` (keep `submitted_at`); `amount > 0`; `discount_amount <= amount` |
| 10 | `otp.sent` audit action removed |
| 11 | Asia/Kolkata time requirement for "today" documented (D49) |
| 12 | `refresh_tokens` and `otp_codes` actor linkage made consistent and explained |

### Open questions remaining

7 open questions (down from 14 in v2). Key items: inactive group customer communication (Q1), worker first-login flow (Q2), admin editing `failure_reason` (Q3), full notification trigger list (Q4).

**Next: awaiting orchestrator instructions.**


---

## Task 5: Database Schema Proposal v4 — Final Candidate (documentation only)

**Date:** 2026-10-12

### Files written

| File | Action |
|---|---|
| `docs/db-schema-proposal-v3.md` | Renamed from `docs/db-schema-proposal.md` (v3 preserved) |
| `docs/db-schema-proposal.md` | Created as v4 — final candidate |

### New decisions incorporated (D50–D52)

| Decision | Summary |
|---|---|
| D50 | Indian phones only (+91); accept 10-digit input, prepend +91, store E.164 — PROPOSED validation rule |
| D51 | `workers.first_login_at` TIMESTAMPTZ NULL — set once on first successful OTP login; never updated — PROPOSED |
| D52 | Login OTP for unknown phone: create row, suppress SMS; registration OTPs rate-limited per IP; `otp_codes.sms_sent` + `request_ip` columns added — PROPOSED |

### Changes to existing decisions

| Decision | Change |
|---|---|
| D19 | Clarified: `pending → success/failed` only; `success ↔ failed` allowed; never back to `pending`. Allowed transition table added. |
| D28–D30, D32, D44, D46, D48 | Status changed from PROPOSED to DECIDED (owner accepted as a block) |
| D36 | Rewritten: notification triggers are (1) new customer registration and (2) worker's first successful OTP login (replaces "new worker registration") |
| D45, D49 | Source changed to "Technical default (accepted by owner)" |

### All required fixes applied

| Fix | Summary |
|---|---|
| 1 | `refresh_tokens` indexes restored: unique on `token_hash`, three partial actor indexes, cleanup `expires_at` index |
| 2 | SMS abuse: login OTP for unknown phone suppresses SMS; per-IP rate limit for registration OTPs; `sms_sent` + `request_ip` columns on `otp_codes` |
| 3 | `resolved_at` defined as set-once (first departure from pending); subsequent changes visible only in `audit_logs` and `updated_at` |
| 4 | All "fix N" references removed from body text; Decision Log source column uses "Owner" or "Technical default (accepted by owner)" |
| 5 | Redundant index `idx_admin_users_email` removed (UNIQUE constraint creates its own index); same audit applied to all tables |
| 6 | D36 and D19 updated in Decision Log; D28–D30, D32, D44, D46, D48 marked DECIDED |
| 7 | Previous "Open questions" Q1–Q5 that are API/UX items moved to new §9 "API Design Notes (not schema)" |
| 8 | §10 "Open Schema Questions" states no open schema questions remain |
| 9 | "Frontend changes" updated: worker first-login notification (item 16), phone +91 auto-add (item 14) |
| 10 | Document status line set to "Final candidate — pending owner sign-off" |

### Structural changes

- `notification_type` enum: `group` value removed (no group notification trigger is decided); can be re-added with `ALTER TYPE … ADD VALUE`
- `workers.first_login_at` column added
- `otp_codes.sms_sent` and `otp_codes.request_ip` columns added
- §9 "API Design Notes (not schema)" added
- §10 "Open Schema Questions" confirms no open schema questions

**Next: awaiting orchestrator instructions.**


---

## Task 6: Database Schema Proposal v5 — Final Candidate Patch (documentation only)

**Date:** 2026-10-12

### Files written

| File | Action |
|---|---|
| `docs/db-schema-proposal-v4.md` | Renamed from `docs/db-schema-proposal.md` (v4 preserved) |
| `docs/db-schema-proposal.md` | Created as v5 — final candidate patch |

### Changes applied

1. **`last_activity_at` recalculation rule:**
   - Whenever a transaction's status transitions between `success` and `failed`, `customers.last_activity_at` is recalculated to the latest remaining `success` transaction's `submitted_at`, or `NULL` if none exist.
   - `workers.last_activity_at` tracks latest submission of any status; it is explicitly confirmed to be **unaffected** by subsequent status transitions.
   - Added to sections 2.4 (customers), 2.5 (workers), 2.8 (transactions), and 4 (computed values). Updated D40.
2. **`otp_codes` timing-safe unknown-phone login & SMS protection:**
   - For login requests on unknown phone numbers: stores NO row and sends NO SMS; returns standard "code sent" response with identical timing (via async SMS delivery).
   - Removed `sms_sent` column and unknown-number row storage logic from schema, text, D52, and Mermaid ER diagram. Retained `request_ip` for registration rate limiting.
3. **Transaction submission idempotency:**
   - Added D53: Presented Option A (recommended: client-generated UUID as `transactions.id`) and Option B (separate `client_request_id` column unique per worker).
4. **`notification_type` pruning:**
   - Pruned enum values to `'registration'` and `'worker'` only (D54). Removed unused `'system'` and `'group'` placeholders until triggers exist.
   - Updated frontend changes item 16 for filter tab updates.
5. **Audit action cleanup:**
   - Removed `transaction.status_change_rejected` action and logging instruction. Forbidden transitions are rejected directly by the API.
6. **Decision Log & status line:**
   - Added D53, D54 (status PROPOSED) to Decision Log; updated D40 and D52.
   - Status updated to "Final candidate v5: pending owner sign-off".

**Next: awaiting orchestrator instructions.**


---

## Task 7: Backend Structure & Architecture Proposal (documentation only)

**Date:** 2026-10-12

### Files written

| File | Action |
|---|---|
| `docs/backend-structure-proposal.md` | Created — backend architecture and structure proposal |

### What was read

- `docs/db-schema-proposal.md` (v5, signed off) — complete data model, constraints, lifecycle rules
- `docs/STATUS.md` — prior task trajectory
- `backend/README.md` — original baseline scope notes
- `frontend/src/services/types.ts` & `adminService.ts` — data interfaces and analytics logic

### Key Architecture & Design Highlights

1. **Folder Layout & Module Boundaries:** Clean vertical domain slices under `backend/src/modules/` (`auth`, `admin-users`, `customers`, `workers`, `groups`, `transactions`, `notifications`, `audit`, `otp`).
2. **Layering & In-Transaction Audit:** Strict unidirectional flow `routes -> controllers -> services -> repositories`. Service layer coordinates transactions using `withTransaction`; `audit_logs` entries are written within the **exact same** database transaction as the state mutation.
3. **Database & Migrations:** Native raw SQL migrations via `node-pg-migrate`. Docker Compose running PostgreSQL 18 on host port `5433` (preventing conflict with host's PostgreSQL 16 on `5432`).
4. **Three-Actor Authentication:** JWT access token with role/audience claims (`admin`, `worker`, `customer`) combined with mandatory per-request database status checks (deactivated admin, suspended worker, inactive customer rejected immediately).
5. **Precision & Rounding:** Handled via `decimal.js` in Node.js matching PostgreSQL `ROUND(numeric, 2)`.
6. **Integrations:**
   - Email: Gmail SMTP via `nodemailer` with Google App Password; interface `IEmailSender` for swappability; reset links emailed and logged to console in dev.
   - SMS: `ISMSSender` interface with console logging adapter for dev.
7. **Validation & Security:** `zod` for DTOs and environment parsing; `pino` with sensitive credential redaction; `helmet`, `cors`, and IP/destination rate limiting.
8. **Testing Strategy:** `vitest` for fast unit and integration tests against real PostgreSQL in Docker.
9. **Windows Support:** Configured for Node v22.15.0 on Windows cmd with cross-platform scripts and port offset.

**Next: awaiting orchestrator instructions.**


---

## Task 8: REST API Proposal (documentation only)

**Date:** 2026-10-12

### Files written

| File | Action |
|---|---|
| `docs/api-proposal.md` | Created — comprehensive REST API specification under `/api/v1` |

### What was read

- `docs/db-schema-proposal.md` (v5, signed off) — complete tables, action codes, business rules
- `docs/STATUS.md` — task history
- `frontend/src/services/adminService.ts` & `types.ts` — mock service layer and interfaces
- `frontend/src/lib/admin-store.tsx` — frontend context and action mutations
- `frontend/src/routes/*` & `frontend/src/components/admin/*` — all pages, dialogs, filters, and reports

### Key Proposal Highlights

1. **API Conventions (§1):**
   - Standard `/api/v1` routes with JSON envelopes for data and errors.
   - Money and litres represented as fixed-decimal strings (2 decimal places) to eliminate precision loss.
   - ISO 8601 UTC timestamps with IST (`Asia/Kolkata`) day-boundary alignment for reports.
   - Rate limiting, idempotent transaction submissions (client-supplied UUID), and token delivery strategy (Authorization header + httpOnly cookie for web admin).
2. **Endpoint Inventory (§2):**
   - Comprehensive tables covering shared auth (`/api/v1/auth/*`), customer app (`/api/v1/customer/*`), worker app (`/api/v1/worker/*`), and admin web panel (`/api/v1/admin/*`).
   - Every endpoint defines method, path, caller, request parameters, response schema, error codes, database tables read/written, audit actions logged, and frontend functions replaced.
3. **Business Rules (§3):**
   - Inactive customer scans rejected (`CUSTOMER_INACTIVE`).
   - Inactive group grants 0% discount without blocking transaction.
   - Suspended workers blocked (`WORKER_SUSPENDED`).
   - Strict transaction status transitions (`pending -> success/failed`, `success <-> failed`, never `* -> pending`).
   - First worker login and customer registration notifications triggered automatically.
   - Default group deletion/deactivation prevention.
4. **Frontend Mapping & Required Changes (§4 & §5):**
   - Complete mapping from all 24 `adminService.ts` and `admin-store.tsx` functions to real API endpoints.
   - 9-point inventory of upcoming frontend adjustments (token interceptor, password field removals, status badge cleanup, etc.).
5. **Mobile Scope & Open Questions (§6 & §7):**
   - Outlines potential customer/worker history endpoints as unconfirmed by owner.
   - Open questions on CSV export approach, admin cookie sessions, and notification retention.

**Next: awaiting orchestrator instructions.**


---

## Task 9: Patch API Proposal & Backend Structure Proposal (documentation only)

**Date:** 2026-10-12

### Files changed / written

| File | Action |
|---|---|
| `docs/api-proposal-draft1.md` | Renamed from original draft |
| `docs/backend-structure-proposal-draft1.md` | Renamed from original draft |
| `docs/api-proposal.md` | Updated v2 with owner decisions & fixes 11–20 |
| `docs/backend-structure-proposal.md` | Updated v2 with owner decisions & fixes 1–10 |
| `docs/STATUS.md` | Appended Task 9 record |

### Changes Applied

1. **Owner Decisions Incorporated (DECIDED):**
   - Non-active workers (`offline` or `suspended`) are completely barred from login, token refresh, and scanning; only status `'active'` is permitted.
   - Admin may edit the default group's discount percent (seeded at 0.00%).
   - CSV reports are built and streamed server-side with chunked transfer encoding (up to 100,000 rows).
   - Admin session: in-memory access token + `httpOnly`, `Secure`, `SameSite=Strict` refresh cookie. Hosting constraint: admin panel and API must share the same site.
   - Notifications are retained indefinitely (background cleanup job does not prune notifications).
   - Added & fully specified mobile endpoints:
     - Customer transaction history (`GET /api/v1/customer/transactions`)
     - Customer profile get & update (`GET /api/v1/customer/profile`, `PATCH /api/v1/customer/profile`)
     - Worker transaction history (`GET /api/v1/worker/transactions`)
     - Worker profile read-only (`GET /api/v1/worker/profile`)
   - Removed unneeded open questions (Redis, admin invitation workflow).
2. **Backend Structure Fixes (PROPOSED / Applied):**
   - Docker Compose: PostgreSQL 18 volume mounted at `/var/lib/postgresql` (not `/data`).
   - Bound database port to localhost only: `"127.0.0.1:5433:5432"`.
   - `.env.example`: Removed pre-filled admin passwords and realistic emails; enforced fail-fast startup guard in production for placeholder secrets.
   - Standalone audit rule: Events with no state change (rejected scans, failed logins) are committed in independent transactions to prevent rollback erasure.
   - Added dedicated `reports` module (`src/modules/reports/`) owning analytics, summary metrics, server-side CSV streaming, and global search.
   - Minimal access token claims (`sub`, `role`, `aud`); removed `REFRESH_TOKEN_SECRET` (refresh tokens are random opaque 256-bit hashes).
   - Password hashing: Selected **Argon2id** via `@node-rs/argon2` with prebuilt Windows native binaries.
   - Test isolation: Truncate tables between test suites against Docker test database.
   - Migration file naming: Zero-padded 3-digit prefixes (`001_*.sql`).
   - Unreachable reason code: Removed `WORKER_SUSPENDED` from `scan.rejected` audit reasons since auth middleware rejects non-active workers prior to scan handler invocation.
3. **API Proposal Fixes (PROPOSED / Applied):**
   - Untrusted `customerId` replaced by cryptographically signed, short-lived `scanTicket` (issued by `POST /worker/scan`, valid 5m) submitted to `POST /worker/transactions`.
   - QR token required to have at least 128 bits of cryptographic entropy, with 30/min rate limit per worker on `/worker/scan`.
   - Idempotency submit check: Returns `200 OK` if payload and worker match; returns `409 Conflict` on mismatch.
   - Worker transaction ownership: Attendants may only update status of their own transactions (`403 NOT_OWN_TRANSACTION`).
   - Single consumption of registration OTP: `/auth/otp/verify` is login-only; `POST /customer/register` directly verifies and consumes registration OTP.
   - First worker login logs no audit entry; admin-created customer produces no notification (self-registration only).
   - Admin login brute-force defense: Progressive delay + per-IP rate limiting (no hard account lockouts).
   - Reports summary metrics return unformatted raw values (numeric counts and 2-decimal money strings).
   - Frontend changes list: Added server-side pagination/filtering/sorting requirements and dedicated `/reset-password` route.

### Commands Run & Real Results

- `PowerShell: Rename-Item`: Renamed proposal drafts. (Exited code 0).
- `cmd /c "npm run typecheck"` in `frontend/`: Exited code 1. Real results: 9 pre-existing TypeScript compiler errors in `src/components/admin/AdminShell.tsx` (lines 169, 174) and `src/routes/_admin.search.tsx` (lines 10, 46, 47, 60, 64, 70, 101).
- `cmd /c "npm run lint"` in `frontend/`: Exited code 1. Real results: 7942 problems (7935 errors, 7 warnings) due to pre-existing Prettier CRLF line ending (`Delete ␍`) formatting across files.
- `npm test`: Script does not exist in `frontend/package.json`, and backend codebase is not yet initialized.

### Deviations

None. All owner instructions and 20 specific fixes were applied strictly to documentation without modifying application source code.

**Next: awaiting orchestrator instructions.**


---

## Task 10: Create docs/PROJECT_CONTEXT.md (documentation only)

**Date:** 2026-10-12

### Files changed / written

| File | Action |
|---|---|
| `docs/PROJECT_CONTEXT.md` | Created — unified ~3-page project context and handoff guide |
| `docs/STATUS.md` | Appended Task 10 record |

### What was documented

1. **Purpose & Scope:** Single petrol pump management system serving Admin Web Panel, Worker Mobile POS, and Customer Loyalty App.
2. **Repository Layout:** Directory breakdown of `frontend/`, `backend/`, and `docs/`.
3. **Technology Stack & Decisions:** Pointers to the primary decision logs in `docs/db-schema-proposal.md` (v5, D01–D54), `docs/backend-structure-proposal.md`, and `docs/api-proposal.md`.
4. **Run Instructions:** Execution steps for `frontend/` (current mock service layer) and `backend/` (target Docker Compose + Express environment).
5. **Working Agreement:** Owner (decides) $\leftrightarrow$ Claude (orchestrates) $\leftrightarrow$ Antigravity (executes). The three core specification documents are the definitive sources of truth; zero assumptions.
6. **Deferred Decisions & Constraints:** Indian SMS TRAI DLT registration and production hosting with the Same-Site cookie constraint (`SameSite=Strict`).
7. **Task History:** Chronological overview of all completed tasks (Tasks 0 through 10).

### Commands Run & Real Results

- `cmd /c "npm run typecheck"` in `frontend/`: Exited code 1. Real results: 9 pre-existing TypeScript compiler errors in `src/components/admin/AdminShell.tsx` and `src/routes/_admin.search.tsx`.
- `cmd /c "npm run lint"` in `frontend/`: Exited code 1. Real results: 7942 problems (7935 errors, 7 warnings) due to pre-existing Prettier CRLF line ending (`Delete ␍`) formatting across files.
- `npm test`: Script does not exist in `frontend/package.json`, and backend codebase is not yet initialized.

### Deviations

None.

**Next: awaiting orchestrator instructions.**


---

## Task 11: Backend Scaffold Initialization (infrastructure only)

**Date:** 2026-10-12

### Files changed / written

| File | Action |
|---|---|
| `backend/package.json` | Created — dependencies, scripts (`dev`, `build`, `start`, `typecheck`, `lint`, `format`, `test`, `migrate`, `migrate:down`, `seed`, `job:cleanup`) |
| `backend/package-lock.json` | Generated — lockfile for 325 packages |
| `backend/tsconfig.json` | Created — NodeNext module resolution, strict mode, target ES2022 |
| `backend/.prettierrc` | Created — 100 printWidth, semi true, endOfLine auto |
| `backend/eslint.config.js` | Created — ESLint 9 flat config for TypeScript + Prettier |
| `backend/vitest.config.ts` | Created — Vitest test runner configuration |
| `backend/.gitignore` | Created — ignores `node_modules`, `dist`, `.env`, `coverage`, logs |
| `backend/.env.example` | Created — template environment configuration |
| `backend/.env` | Created locally (gitignored) |
| `backend/docker-compose.yml` | Created — PostgreSQL 18-alpine, port `127.0.0.1:5433:5432`, volume `/var/lib/postgresql` |
| `backend/README.md` | Overwritten — setup guide, directory structure, Docker and dev commands |
| `backend/src/config/env.ts` | Created — Zod schema validation with production fail-fast checks |
| `backend/src/config/database.ts` | Created — PoolConfig mapping from validated environment variables |
| `backend/src/db/pool.ts` | Created — Singleton pg.Pool instance with error hooks |
| `backend/src/db/transaction.ts` | Created — withTransaction helper for atomic query execution |
| `backend/src/common/utils/logger.ts` | Created — Pino logger with credential redaction & pretty-printing in dev |
| `backend/src/common/errors/app-error.ts` | Created — Standard AppError hierarchy matching API error codes |
| `backend/src/common/middleware/error-handler.ts` | Created — Global error handler returning standard error envelope |
| `backend/src/common/middleware/validate.ts` | Created — Request schema validation middleware (body, query, params) |
| `backend/src/common/middleware/request-logger.ts` | Created — HTTP request logger middleware via pino-http |
| `backend/src/common/middleware/rate-limiter.ts` | Created — General rate limiter middleware (100 req/min) |
| `backend/src/app.ts` | Created — Express application setup, Helmet, CORS, JSON parser, /health, 404 & error handlers |
| `backend/src/server.ts` | Created — Server entry point, port listener, graceful shutdown handlers |
| `backend/src/tests/health.test.ts` | Created — Integration tests for /api/v1/health and 404 responses |
| `docs/STATUS.md` | Appended Task 11 completion record |

### What was implemented

1. **Backend Infrastructure:** Scaffolding matching the layout defined in `docs/backend-structure-proposal.md`.
2. **PostgreSQL Container:** Docker Compose configured with PostgreSQL 18-alpine, listening on `127.0.0.1:5433:5432` with named volume `pgdata` mounted to `/var/lib/postgresql`.
3. **Environment & Database Pool:** Zod-validated configuration ensuring critical secrets cannot be default strings in production; `pg.Pool` instance configured with connection timeout and query hooks.
4. **Error Handling & Middleware:** Standardized response envelopes (`{ error: { code, message, details } }`), rate limiting (100 req/min), CORS with credentials support, Helmet HTTP security headers.
5. **Health Endpoint:** `GET /api/v1/health` verifying active database connectivity using `SELECT 1`.
6. **Graceful Shutdown:** Process signals (`SIGINT`, `SIGTERM`) handled to cleanly drain HTTP connections and close the Postgres pool.

### Commands Run & Real Results

- `cmd /c "docker compose up -d"` in `backend/`: Exited code 0. Image `postgres:18-alpine` pulled; container `fuelpoint-postgres` created and started.
- `cmd /c "npm install"` in `backend/`: Exited code 0. Added 325 packages.
- `cmd /c "npm run typecheck"` in `backend/`: Exited code 0. `tsc --noEmit` completed with 0 errors.
- `cmd /c "npm run format"` in `backend/`: Exited code 0. Prettier formatted files.
- `cmd /c "npm run lint"` in `backend/`: Exited code 0. ESLint completed with 0 problems.
- `cmd /c "npm test"` in `backend/`: Exited code 0. 1 test file passed, 2 tests passed (`src/tests/health.test.ts`) using Vitest against the Docker Postgres instance.
- `cmd /c "npm run build"` in `backend/`: Exited code 0. TypeScript compilation succeeded.
- `cmd /c "npm run dev"` & `curl -i http://localhost:3000/api/v1/health`: Exited code 0. Returned HTTP 200 OK with `{"status":"ok","timestamp":"2026-10-12T11:12:34.805Z","database":"connected"}`.

### Deviations

None.

### Recommendations

- To prevent Git line-ending warnings across operating systems (CRLF on Windows vs LF in Linux/Docker), a repository root `.gitattributes` file (`* text=auto eol=lf`) is recommended to be added in a subsequent task.

**Next: awaiting orchestrator instructions.**


---

## Task 12: Database migrations, seed data and constraint tests

**Date:** 2026-10-12

### Files changed / written

| File | Action |
|---|---|
| `backend/migrations/001_extensions_and_types.sql` | Created — `pgcrypto` extension + 9 custom ENUM types with reversible down section |
| `backend/migrations/002_core_entities.sql` | Created — `groups`, `admin_users`, `customers`, `workers` tables, check constraints, partial unique indexes |
| `backend/migrations/003_auth_and_verification.sql` | Created — `admin_password_reset_tokens`, `otp_codes`, `refresh_tokens` tables, constraints, cleanup indexes |
| `backend/migrations/004_activity_and_events.sql` | Created — `transactions`, `notifications`, `audit_logs` tables, money/discount checks, date-range indexes |
| `backend/migrations/005_triggers_and_functions.sql` | Created — `set_updated_at` function/triggers, `prevent_audit_mutation` function/trigger on `audit_logs` |
| `backend/src/db/migrate.ts` | Created — programmatic and CLI migration runner using `node-pg-migrate` with `legacySql` loader |
| `backend/src/seeds/default-group.seed.ts` | Created — idempotent insertion of default group (0% discount, UUID `00000000-0000-0000-0000-000000000001`) |
| `backend/src/seeds/first-admin.seed.ts` | Created — initial Super Admin seeding with Argon2id hash; password from env or random 16-char generated |
| `backend/src/seeds/seed.ts` | Created — CLI runner for database seeders (`npm run seed`) |
| `backend/src/tests/test-db.ts` | Created — connection pool and truncation helpers for dedicated test database (`fuelpoint_test`) |
| `backend/src/tests/constraints.test.ts` | Created — 18 Vitest tests verifying partial indexes, soft-delete exclusion, check constraints, FK RESTRICT, triggers |
| `backend/package.json` | Modified — added `node-pg-migrate` dependency; wired `migrate`, `migrate:down`, and `seed` scripts |
| `backend/package-lock.json` | Modified — updated lockfile for `node-pg-migrate` |
| `docs/STATUS.md` | Appended Task 12 completion record |

### Differences Between SQL and Schema v5

**None.** The migration files match `docs/db-schema-proposal.md` (v5) exactly across all 10 tables, 9 enums, CHECK constraints, partial unique indexes, foreign keys, and trigger definitions.

### What was implemented

1. **node-pg-migrate Migrations:** Five sequential migration files with matching `-- Up Migration` and `-- Down Migration` sections:
   - `001_extensions_and_types.sql`: `pgcrypto` + `customer_status`, `worker_shift`, `worker_status`, `transaction_status`, `fuel_type`, `notification_type`, `otp_channel`, `otp_actor_type`, `otp_purpose`.
   - `002_core_entities.sql`: `groups` (with active name & default group partial unique indexes, 0–100 discount check), `admin_users` (unique email, partial unique non-null phone), `customers` (partial unique active phone & email, global unique QR token, group FK ON DELETE RESTRICT), `workers` (partial unique active phone & email).
   - `003_auth_and_verification.sql`: `admin_password_reset_tokens` (ON DELETE CASCADE), `otp_codes` (attempts >= 0 check, actor XOR check), `refresh_tokens` (exact one actor check: `num_nonnulls(admin_user_id, customer_id, worker_id) = 1`, actor FKs RESTRICT/CASCADE, `replaced_by` SET NULL).
   - `004_activity_and_events.sql`: `transactions` (amount > 0, discount percent 0..100, discount amount 0..amount, optional litres > 0, FKs ON DELETE RESTRICT), `notifications` (at most one entity linked check), `audit_logs` (append-only ledger).
   - `005_triggers_and_functions.sql`: `set_updated_at()` trigger on mutable tables; `prevent_audit_mutation()` trigger enforcing immutable append-only ledger on `audit_logs`.
2. **Migration Runner:** `src/db/migrate.ts` executing `node-pg-migrate` runner with `legacySql` loader strategy, handling both CLI and programmatic calls across dev and test databases.
3. **Idempotent Seeds:**
   - Default group: Idempotent `INSERT ... ON CONFLICT (is_default) WHERE is_default = TRUE AND deleted_at IS NULL DO NOTHING`.
   - First Admin: Verifies existing admin presence before inserting; hashes password using Argon2id; prints credentials to console when generated or in development.
4. **Dedicated Test Database (`fuelpoint_test`):** Created and migrated on Docker PostgreSQL port `5433`.
5. **Constraint & Trigger Test Suite:** 18 tests in `src/tests/constraints.test.ts` verifying all partial unique indexes (with soft-delete exclusion), checks, foreign key RESTRICT behaviors, and database triggers.

### Commands Run & Real Results

- `cmd /c 'docker exec -i fuelpoint-postgres psql -U postgres -d postgres -c "CREATE DATABASE fuelpoint_test;"'`: Exited code 0 (`CREATE DATABASE`).
- `cmd /c "npm install node-pg-migrate"`: Exited code 0 (added 21 packages).
- `cmd /c "npx tsx src/db/migrate.ts up"`: Exited code 0 (5 migrations applied to `fuelpoint`).
- `cmd /c "npx tsx src/db/migrate.ts down 5"`: Exited code 0 (5 migrations reverted cleanly from `fuelpoint`).
- `cmd /c "npx tsx src/db/migrate.ts up"`: Exited code 0 (5 migrations re-applied to `fuelpoint`).
- `cmd /c "npx cross-env DB_NAME=fuelpoint_test tsx src/db/migrate.ts up"`: Exited code 0 (5 migrations applied to `fuelpoint_test`).
- `cmd /c "npm run seed"`: Exited code 0 (default group and first Super Admin seeded; credentials logged).
- `cmd /c "npm run seed"` (idempotency run): Exited code 0 ("Default group already exists, skipping", "Admin user already exists, skipping admin seed").
- `cmd /c "npm run typecheck"`: Exited code 0 (`tsc --noEmit` passed with 0 errors).
- `cmd /c "npm run format"`: Exited code 0 (Prettier formatted files).
- `cmd /c "npm run lint"`: Exited code 0 (ESLint passed with 0 errors and 0 warnings).
- `cmd /c "npm test"`: Exited code 0 (2 test files passed, 20 tests passed: 18 constraint tests + 2 health/404 tests in 6.02s).
- `cmd /c "npm run build"`: Exited code 0 (`tsc` emitted without error).

### Deviations

None.

---

## Task 13: Admin Authentication, Profile, and Password Flows

**Date:** 2026-10-12

### Files changed / written

| File | Action |
|---|---|
| `backend/src/common/types/common.ts` | Created — `AuthActor`, `AccessTokenPayload`, `RefreshTokenRecord` interfaces |
| `backend/src/common/types/express.d.ts` | Created — ambient module augmentation for Express `Request.actor` |
| `backend/src/common/utils/crypto.ts` | Created — Argon2id hash/verify, SHA-256 hash, token generation, JWT sign/verify (`jsonwebtoken`) |
| `backend/src/common/utils/phone.ts` | Created — Indian phone number normalization (+91 E.164 format) |
| `backend/src/integrations/email/email-sender.interface.ts` | Created — `IEmailSender` contract (`sendPasswordResetEmail`) |
| `backend/src/integrations/email/nodemailer-gmail.ts` | Created — Production Gmail SMTP transport over SSL via `nodemailer` |
| `backend/src/integrations/email/dev-email-logger.ts` | Created — Development logger simulating email delivery with clickable console reset URL |
| `backend/src/integrations/email/index.ts` | Created — factory dynamically resolving active email service based on environment variables |
| `backend/src/modules/audit/audit.repository.ts` | Created — SQL queries for inserting audit log entries with sensitive field redaction |
| `backend/src/modules/audit/audit.service.ts` | Created — audit logging service supporting both in-transaction and standalone independent logging |
| `backend/src/common/middleware/auth.ts` | Created — JWT bearer token verification + live DB `is_active` validation, and role authorization guard (`requireRole`) |
| `backend/src/common/middleware/validate.ts` | Modified — exported `validate` Zod middleware helper |
| `backend/src/common/errors/app-error.ts` | Modified — added `RateLimitError` alias class |
| `backend/src/modules/auth/login-protection.ts` | Created — sliding window per-IP rate limiter (10 attempts / 15 min) and progressive delay calculator (1s, 2s, 4s) |
| `backend/src/modules/auth/auth.repository.ts` | Created — queries for admin lookup, refresh token management, token rotation, reuse detection revocation, password reset tokens |
| `backend/src/modules/auth/auth.service.ts` | Created — core domain logic for login, refresh token rotation/reuse revocation, single & all-devices logout, constant-time forgot password, reset password |
| `backend/src/modules/auth/auth.controller.ts` | Created — HTTP controllers for `/api/v1/auth/*` routes handling cookies and response envelopes |
| `backend/src/modules/auth/auth.routes.ts` | Created — Express routes with Zod validation schemas for all auth endpoints |
| `backend/src/modules/admin-users/admin.repository.ts` | Created — repository for admin user retrieval, profile updating, and password change |
| `backend/src/modules/admin-users/admin.service.ts` | Created — service for profile viewing, updating, and password changing with old password verification |
| `backend/src/modules/admin-users/admin.controller.ts` | Created — HTTP controllers for `/api/v1/admin/profile` and change password |
| `backend/src/modules/admin-users/admin.routes.ts` | Created — Express routes with validation schemas for admin profile endpoints |
| `backend/src/app.ts` | Modified — wired `cookieParser()`, mounted `/api/v1/auth` and `/api/v1/admin` routers |
| `backend/src/db/migrate.ts` | Modified — configured `advisoryLockMode: "wait"` for safe concurrent migration runs |
| `backend/vitest.config.ts` | Modified — configured `fileParallelism: false` so test suites execute sequentially against real database |
| `backend/README.md` | Modified — added step-by-step Gmail App Password setup documentation for production SMTP |
| `backend/package.json` | Modified — added dependencies: `jsonwebtoken`, `cookie-parser`, `nodemailer` and dev types |
| `backend/package-lock.json` | Modified — updated package-lock for new dependencies |
| `backend/src/tests/auth.service.test.ts` | Created — 10 unit tests for Argon2id hashing, SHA-256 tokens, JWT sign/verify, phone normalization, login protection |
| `backend/src/tests/admin-auth.test.ts` | Created — 15 integration tests for login, refresh rotation, reuse detection revocation, single/all-devices logout, forgot/reset password |
| `backend/src/tests/admin-profile.test.ts` | Created — 9 integration tests for profile get/patch and password changes |
| `docs/STATUS.md` | Appended Task 13 completion record |

### What was implemented

1. **Admin Authentication Endpoints (`/api/v1/auth/*`):**
   - `POST /api/v1/auth/admin/login`: Progressive delay (1s after 2 failed attempts, 2s after 3, 4s after $\ge 4$) + 10 requests per 15 min per IP limit. Standalone audit log recorded on failure without committing a transaction. Returns short-lived access token in body and sets `httpOnly`, `SameSite=Strict`, `Secure` (in prod) refresh token cookie.
   - `POST /api/v1/auth/refresh`: Reads cookie, verifies SHA-256 token in database. Rotates token immediately. Detects reused revoked tokens: if a revoked token is presented, immediately revokes all descendant and ancestor tokens in the lineage and rejects request with 401.
   - `POST /api/v1/auth/logout`: Revokes either the current cookie token (`allDevices=false`) or all active refresh tokens for the authenticated admin (`allDevices=true`). Clears cookie.
   - `POST /api/v1/auth/admin/forgot-password`: Constant-time execution (always takes $\ge 500\text{ms}$) returning generic message regardless of email existence. Generates 32-byte secure token expiring in 1 hour. Dispatches email via `IEmailSender` (logs clickable link to console in dev).
   - `POST /api/v1/auth/admin/reset-password`: Validates token, hashes new password with Argon2id, marks token used, and immediately revokes all active refresh tokens for the admin.
2. **Admin Profile Endpoints (`/api/v1/admin/*`):**
   - `GET /api/v1/admin/profile`: Returns authenticated admin profile excluding password hash.
   - `PATCH /api/v1/admin/profile`: Updates name and phone with E.164 normalization (+91).
   - `POST /api/v1/admin/profile/change-password`: Validates current password, hashes new password with Argon2id, and writes audit record.
3. **Security, Email, and Database Integration:**
   - Password hashing: Argon2id (memory cost 64MB, 3 iterations, 4 parallelism).
   - Refresh tokens: SHA-256 hashed in database; raw hex tokens in client cookie.
   - Access tokens: Signed JWT with `{ sub, role: "admin", aud: "fuelpoint-api" }`, verified via `authMiddleware` that checks database `is_active` on every request.
   - Audit logging: Append-only ledger recording admin action details with passwords redacted.
   - Gmail App Password generation guide documented in `backend/README.md`.

### Commands Run & Real Results

- `cmd /c "npm install jsonwebtoken cookie-parser nodemailer && npm install -D @types/jsonwebtoken @types/cookie-parser @types/nodemailer"`: Exited code 0 (added 13 packages).
- `cmd /c "npm test"`: Exited code 0 (5 test files passed, 54 tests passed in 14.29s).
  - `src/tests/constraints.test.ts` (18 tests passed)
  - `src/tests/admin-profile.test.ts` (9 tests passed)
  - `src/tests/admin-auth.test.ts` (15 tests passed)
  - `src/tests/health.test.ts` (2 tests passed)
  - `src/tests/auth.service.test.ts` (10 tests passed)
- `cmd /c "npm run typecheck"`: Exited code 0 (`tsc --noEmit` passed with 0 errors).
- `cmd /c "npm run format"`: Exited code 0 (Prettier formatted all source files).
- `cmd /c "npm run lint"`: Exited code 0 (ESLint passed with 0 errors and 0 warnings).
- `cmd /c "npm run build"`: Exited code 0 (`tsc` emitted without error).

### Deviations

None.

---

## Task 14: Groups Module (Admin Endpoints)

**Date:** 2026-10-12

### Files changed / written

| File | Action |
|---|---|
| `backend/src/modules/groups/group.repository.ts` | Created — Hand-written SQL queries for groups retrieval with active customer count, unique active name checks, default group resolution, insert, update, toggle active, customer reassignment, and soft delete |
| `backend/src/modules/groups/group.service.ts` | Created — Domain logic enforcing all business rules: default group immutability guards (cannot delete or deactivate), discount validation (0..100), duplicate name conflict handling, atomic member reassignment to default group on deletion, and transactional audit logging (`group.created`, `group.updated`, `group.toggled`, `group.deleted`) |
| `backend/src/modules/groups/group.controller.ts` | Created — HTTP controllers for `/api/v1/admin/groups` list, create, edit, toggle-active, and delete endpoints |
| `backend/src/modules/groups/group.routes.ts` | Created — Express routes with Zod schemas for UUID path parameters and request body validation; protected with `authMiddleware` and `requireRole('admin')` |
| `backend/src/modules/admin-users/admin.routes.ts` | Modified — Mounted `groupRouter` under `/groups` |
| `backend/src/common/types/common.ts` | Modified — Exported `AuthActor` alias type |
| `backend/src/tests/groups.test.ts` | Created — 21 integration tests covering all 5 endpoints, default group protection, duplicate name conflict, discount boundary validation, member reassignment on delete, audit trail verification, and role/auth guards |
| `docs/STATUS.md` | Appended Task 14 completion record |

### What was implemented

1. **`GET /api/v1/admin/groups`:** Returns all non-deleted groups ordered with the default group first, followed by alphabetical order. Computes real-time `customerCount` matching non-deleted customers.
2. **`POST /api/v1/admin/groups`:** Creates new group with name, discount percent (0 to 100), optional description, and active status. Rejects duplicate names among non-deleted groups with `409 Conflict` (`DUPLICATE_GROUP_NAME`). Records `group.created` audit log in the same database transaction.
3. **`PATCH /api/v1/admin/groups/:id`:** Edits group name, discount percent, and description. Allows editing name and discount percent for the default group. Validates name uniqueness if changed. Records `group.updated` audit log capturing changed fields in the same database transaction.
4. **`PATCH /api/v1/admin/groups/:id/toggle-active`:** Toggles group `active` status. Enforces rule that the default group cannot be deactivated (`400 Bad Request`, `CANNOT_DEACTIVATE_DEFAULT_GROUP`). Records `group.toggled` audit log in the same database transaction.
5. **`DELETE /api/v1/admin/groups/:id`:** Soft deletes a group (`deleted_at = now()`). Enforces rule that the default group cannot be deleted (`400 Bad Request`, `CANNOT_DELETE_DEFAULT_GROUP`). In the exact same database transaction, atomically reassigns all customers in the deleted group to the default group before setting `deleted_at`, and records `group.deleted` with the count of reassigned members in the audit log.

### Commands Run & Real Results

- `cmd /c "npm test"`: Exited code 0 (6 test files passed, 75 tests passed in 21.47s).
  - `src/tests/groups.test.ts` (21 tests passed)
  - `src/tests/constraints.test.ts` (18 tests passed)
  - `src/tests/admin-auth.test.ts` (15 tests passed)
  - `src/tests/admin-profile.test.ts` (9 tests passed)
  - `src/tests/auth.service.test.ts` (10 tests passed)
  - `src/tests/health.test.ts` (2 tests passed)
- `cmd /c "npm run typecheck"`: Exited code 0 (`tsc --noEmit` passed with 0 errors).
- `cmd /c "npm run format"`: Exited code 0 (Prettier formatted all source files).
- `cmd /c "npm run lint"`: Exited code 0 (ESLint passed with 0 errors, 0 warnings).
- `cmd /c "npm run build"`: Exited code 0 (`tsc` emitted without error).

### Deviations

None.

---

## Task 15: Customers Module (Admin Endpoints)

**Date:** 2026-10-12

### Files changed / written

| File | Action |
|---|---|
| `backend/src/common/utils/email.ts` | Created — Email normalization (`toLowerCase()`, whitespace trimming, format check) |
| `backend/src/common/utils/crypto.ts` | Modified — Added `generateQrToken()` with 192 bits of entropy in URL-safe base64 |
| `backend/src/modules/customers/customer.repository.ts` | Created — Repository for customer queries, server-side pagination, search `q`, status/group filtering, success transaction aggregates, lock-for-update, token revocations, and soft deletion |
| `backend/src/modules/customers/customer.service.ts` | Created — Service handling customer creation (NO notification, phone/email validation, default group fallback), detail with recent transactions, edit with uniqueness checks, status updates with token revocations, group assignment, soft deletion with token revocations, and transactional audit logging |
| `backend/src/modules/customers/customer.controller.ts` | Created — HTTP controllers for `/api/v1/admin/customers` endpoints |
| `backend/src/modules/customers/customer.routes.ts` | Created — Express routes with Zod validation schemas for query parameters, UUID path parameters, and request payloads; protected with `authMiddleware` and `requireRole('admin')` |
| `backend/src/modules/admin-users/admin.routes.ts` | Modified — Mounted `customerRouter` under `/customers` |
| `backend/src/tests/auth.service.test.ts` | Modified — Added 4 unit tests for `normalizeEmail` and `generateQrToken` |
| `backend/src/tests/customers.test.ts` | Created — 22 integration tests covering all 7 customer endpoints, success transaction aggregates, filtering, search, token revocations on inactive and soft delete, and audit logging |
| `docs/STATUS.md` | Appended Task 15 completion record |

### What was implemented

1. **`GET /api/v1/admin/customers`:** Server-side pagination (`page`, `limit`), sorting (`sort_by`, `order`), search (`q` across name, phone, email, vehicle), and filtering (`status`, `group_id`). Computes `transactions`, `totalSpend`, and `discountReceived` aggregates counting `success` transactions only. Excludes soft-deleted records.
2. **`GET /api/v1/admin/customers/:id`:** Retrieves customer profile, aggregates, group metadata, `qrToken`, and up to 10 `recentTransactions`.
3. **`POST /api/v1/admin/customers`:** Admin customer creation. Normalizes phone (+91 E.164) and lowercases email. Generates $\ge 128$-bit URL-safe `qr_token`. Resolves target group or falls back to default group. Confirmed rule: **creates NO notification**. Commits `customer.created` audit log in the same database transaction.
4. **`PATCH /api/v1/admin/customers/:id`:** Updates customer name, phone, email, and vehicle. Enforces unique phone and email checks across non-deleted customers. Commits `customer.updated` audit log with old and new values in the same database transaction.
5. **`PATCH /api/v1/admin/customers/:id/status`:** Toggles customer between `active` and `inactive`. Enforces rule: **setting a customer inactive immediately revokes all active refresh tokens for that customer**. Commits `customer.status_changed` audit log in the same database transaction.
6. **`PATCH /api/v1/admin/customers/:id/group`:** Reassigns a customer to an active group. Commits `customer.group_assigned` audit log with previous and new group details in the same database transaction.
7. **`DELETE /api/v1/admin/customers/:id`:** Soft deletes customer (`deleted_at = now()`). Enforces rule: **soft-deleting a customer immediately revokes all active refresh tokens for that customer**. Commits `customer.deleted` audit log in the same database transaction.

### Commands Run & Real Results

- `cmd /c "npm test"`: Exited code 0 (7 test files passed, 101 tests passed in 25.51s).
  - `src/tests/customers.test.ts` (22 tests passed)
  - `src/tests/groups.test.ts` (21 tests passed)
  - `src/tests/constraints.test.ts` (18 tests passed)
  - `src/tests/admin-auth.test.ts` (15 tests passed)
  - `src/tests/admin-profile.test.ts` (9 tests passed)
  - `src/tests/auth.service.test.ts` (14 tests passed)
  - `src/tests/health.test.ts` (2 tests passed)
- `cmd /c "npm run typecheck"`: Exited code 0 (`tsc --noEmit` passed with 0 errors).
- `cmd /c "npm run format"`: Exited code 0 (Prettier formatted all source files).
- `cmd /c "npm run lint"`: Exited code 0 (ESLint passed with 0 errors, 0 warnings).
- `cmd /c "npm run build"`: Exited code 0 (`tsc` emitted without error).

### Deviations

None.

---

## Task 16: Workers Module (Admin Endpoints)

**Date:** 2026-10-12

### Files changed / written

| File | Action |
|---|---|
| `backend/src/modules/workers/worker.repository.ts` | Created — Hand-written SQL queries for worker listing with server-side pagination, sorting, search `q`, status and shift filters, scans and success-transaction aggregates, lock-for-update, refresh token revocation, recent transactions, and soft delete |
| `backend/src/modules/workers/worker.service.ts` | Created — Domain logic for worker operations: phone and email normalization, duplicate checks across non-deleted workers, status transition rules (suspending revokes active tokens; offline does not revoke tokens), soft deletion (revokes active tokens), and transactional audit logging (`worker.created`, `worker.updated`, `worker.status_changed`, `worker.deleted`) |
| `backend/src/modules/workers/worker.controller.ts` | Created — HTTP controllers for `/api/v1/admin/workers` endpoints |
| `backend/src/modules/workers/worker.routes.ts` | Created — Express routes with Zod validation schemas for query parameters, UUID path parameters, and request bodies; protected with `authMiddleware` and `requireRole('admin')` |
| `backend/src/modules/admin-users/admin.routes.ts` | Modified — Mounted `workerRouter` under `/workers` |
| `backend/src/tests/workers.test.ts` | Created — 23 integration tests covering all 6 worker endpoints, status and shift filters, search `q`, success vs submitted aggregates, token revocations on suspension and soft delete, and transactional audit logs |
| `docs/STATUS.md` | Appended Task 16 completion record |

### What was implemented

1. **`GET /api/v1/admin/workers`:** Server-side pagination (`page`, `limit`), sorting (`sort_by`, `order`), search (`q` across name, phone, email), and filters (`status`, `shift`). Computes aggregates:
   - `scans`: Total submitted transactions (`COUNT(t.id)` across all statuses)
   - `transactions`: Count of `success` transactions
   - `customersScanned`: Unique customers with `success` transactions (`COUNT(DISTINCT t.customer_id)`)
   - `discountProcessed`: Sum of `discount_amount` on `success` transactions
   - Excludes soft-deleted workers.
2. **`GET /api/v1/admin/workers/:id`:** Retrieves worker profile with timestamps, performance aggregates, and up to 10 `recentTransactions` ordered by `submitted_at DESC`.
3. **`POST /api/v1/admin/workers`:** Creates a worker (name, phone, email, shift, optional status defaulting to `active`). Normalizes phone (+91 E.164) and lowercases email. Rejects duplicates with `409 Conflict`. Commits `worker.created` audit log in the same database transaction.
4. **`PATCH /api/v1/admin/workers/:id`:** Edits worker name, phone, email, or shift. Validates format and uniqueness on changed phone/email. Commits `worker.updated` audit log with diff of changed fields in the same database transaction.
5. **`PATCH /api/v1/admin/workers/:id/status`:** Updates status (`active`, `offline`, `suspended`). Enforces rule:
   - Setting `suspended`: Immediately revokes all active refresh tokens for the worker.
   - Setting `offline`: Does **NOT** revoke refresh tokens (per-request middleware status check blocks execution until active).
   - Commits `worker.status_changed` audit log in the same database transaction.
6. **`DELETE /api/v1/admin/workers/:id`:** Soft deletes worker (`deleted_at = now()`). Explicitly revokes all active refresh tokens for the worker. Commits `worker.deleted` audit log in the same database transaction. Excludes deleted worker from subsequent list and detail requests (`404 Not Found`).

### Commands Run & Real Results

- `cmd /c "npm test"`: Exited code 0 (8 test files passed, 124 tests passed in 34.17s).
  - `src/tests/workers.test.ts` (23 tests passed)
  - `src/tests/customers.test.ts` (22 tests passed)
  - `src/tests/groups.test.ts` (21 tests passed)
  - `src/tests/constraints.test.ts` (18 tests passed)
  - `src/tests/admin-auth.test.ts` (15 tests passed)
  - `src/tests/admin-profile.test.ts` (9 tests passed)
  - `src/tests/auth.service.test.ts` (14 tests passed)
  - `src/tests/health.test.ts` (2 tests passed)
- `cmd /c "npm run typecheck"`: Exited code 0 (`tsc --noEmit` passed with 0 errors).
- `cmd /c "npm run format"`: Exited code 0 (Prettier formatted all source files).
- `cmd /c "npm run lint"`: Exited code 0 (ESLint passed with 0 errors, 0 warnings).
- `cmd /c "npm run build"`: Exited code 0 (`tsc` emitted without error).

### Deviations

None.

---

## Task 17: OTP Module, Customer Registration, Worker/Customer Login & QR Management

**Date:** 2026-10-12

### Files changed / written

| File | Action |
|---|---|
| `backend/src/common/utils/crypto.ts` | Modified — Added cryptographically secure 6-digit numeric generator `generateOtp()` |
| `backend/src/integrations/sms/sms-sender.interface.ts` | Created — Defined `ISmsSender` interface for sending SMS notifications and OTPs |
| `backend/src/integrations/sms/console-sms-sender.ts` | Created — Development SMS sender logging masked dispatch / simulated OTP to console and recording history for testing |
| `backend/src/integrations/sms/index.ts` | Created — Exported singleton `smsSender` instance |
| `backend/src/modules/notifications/notification.repository.ts` | Created — Repository for inserting system notifications (`worker`, `registration`) |
| `backend/src/modules/notifications/notification.service.ts` | Created — Notification service for worker first login and customer self-registration events |
| `backend/src/modules/otp/otp.repository.ts` | Created — Repository managing `otp_codes` table with rate limits (cooldown, destination hourly, IP hourly), verification, attempt tracking, and consumption |
| `backend/src/modules/otp/otp.service.ts` | Created — Domain logic for OTP generation, sending, verification for registration & login, rate limit enforcement, and timing-safe handling for unknown login phone |
| `backend/src/modules/customers/customer-mobile.service.ts` | Created — Domain service handling customer registration (placing in default group, generating 192-bit URL-safe QR token, transactional audit logging `customer.created`), retrieving QR data, and atomic QR code regeneration (`customer.qr_regenerated` audit log with zero token leakage) |
| `backend/src/modules/customers/customer-mobile.controller.ts` | Created — HTTP controllers for `/api/v1/customer/register`, `/api/v1/customer/qr`, and `/api/v1/customer/qr/regenerate` |
| `backend/src/modules/customers/customer-mobile.routes.ts` | Created — Routes with Zod validation schemas and authentication middleware for customer mobile endpoints |
| `backend/src/modules/auth/auth.service.ts` | Modified — Extended token refresh and logout to support customer and worker actors, enforcing 30-day token rotation, status verification, reuse detection (revoking all sessions), and `allDevices: true` logout |
| `backend/src/modules/auth/auth.controller.ts` | Modified — Added `requestOtp` and `verifyOtp` handlers, and enhanced refresh/logout to accept tokens in request body for mobile apps |
| `backend/src/modules/auth/auth.routes.ts` | Modified — Mounted `/otp/request` and `/otp/verify` endpoints with rate limiting and Zod validation |
| `backend/src/common/middleware/auth.ts` | Modified — Enforced active account status check for customer and worker tokens on protected routes |
| `backend/src/app.ts` | Modified — Mounted `customerMobileRouter` under `/api/v1/customer` |
| `backend/src/tests/otp.test.ts` | Created — 24 comprehensive integration tests covering OTP request/verify flows, registration, worker/customer login, cooldown/rate limiting, QR retrieval/regeneration, audit logging, and token rotation |
| `docs/STATUS.md` | Appended Task 17 completion record |

### What was implemented

1. **`POST /api/v1/auth/otp/request`:**
   - Validates purpose (`login` or `register`) and phone format (10-digit Indian number normalized to `+91XXXXXXXXXX`).
   - Rate limiting: 60-second cooldown per destination, 5 requests/hour per destination, and 10 registration requests/hour per IP address.
   - For `purpose: 'register'`: checks customer uniqueness. Returns `409 Conflict` if phone is already registered. Generates and stores 6-digit OTP code hash in `otp_codes` (5-minute expiry).
   - For `purpose: 'login'`: resolves actor across customers and workers. For unregistered numbers, returns standard timing-safe response (`200 OK`, `{"message": "Code sent", "cooldown": 60}`) without inserting rows or dispatching SMS.
2. **`POST /api/v1/auth/otp/verify`:**
   - Dedicated login verification endpoint. Checks OTP hash, expiry, and max 5 attempts.
   - Rejects inactive/soft-deleted customers (`403 Forbidden`).
   - Rejects offline workers (`403 WORKER_NOT_ACTIVE`) and suspended workers (`403 WORKER_SUSPENDED`).
   - For worker's first login: atomically updates `first_login_at` and creates a `worker` system notification.
   - Marks OTP code consumed and generates access and 30-day refresh tokens.
3. **`POST /api/v1/customer/register`:**
   - Verifies OTP code directly for registration.
   - Creates new customer record in default group (`DEFAULT_GROUP_ID`) with `active` status.
   - Generates 192-bit URL-safe QR token.
   - Emits system notification `registration` and audit log `customer.created`.
   - Returns authentication tokens and customer payload.
4. **`GET /api/v1/customer/qr`:**
   - Customer-only endpoint returning current `qrToken`, `name`, `phone`, and `group` name.
5. **`POST /api/v1/customer/qr/regenerate`:**
   - Customer-only endpoint atomically rotating the `qr_token`.
   - Writes transactional audit log `customer.qr_regenerated` with **no** token value recorded in the log.
6. **Mobile Token Rotation & Logout:**
   - `POST /api/v1/auth/refresh` & `POST /api/v1/auth/logout` support passing `refreshToken` directly in the request body (with fallback to HTTP-only cookie).
   - Validates actor active status on refresh.
   - Enforces 30-day rotation, reuse detection (all tokens for actor revoked on token reuse), and supports `allDevices: true`.

### Commands Run & Real Results

- `cmd /c "npm test"`: Exited code 0 (9 test files passed, 148 tests passed in 40.20s).
  - `src/tests/otp.test.ts` (24 tests passed)
  - `src/tests/workers.test.ts` (23 tests passed)
  - `src/tests/customers.test.ts` (22 tests passed)
  - `src/tests/groups.test.ts` (21 tests passed)
  - `src/tests/constraints.test.ts` (18 tests passed)
  - `src/tests/admin-auth.test.ts` (15 tests passed)
  - `src/tests/admin-profile.test.ts` (9 tests passed)
  - `src/tests/auth.service.test.ts` (14 tests passed)
  - `src/tests/health.test.ts` (2 tests passed)
- `cmd /c "npm run typecheck"`: Exited code 0 (`tsc --noEmit` passed with 0 errors).
- `cmd /c "npm run format"`: Exited code 0 (Prettier formatted all source files).
- `cmd /c "npm run lint"`: Exited code 0 (ESLint passed with 0 errors, 0 warnings).
- `cmd /c "npm run build"`: Exited code 0 (`tsc` emitted without error).

### Deviations

None.

---

## Task 18: Transaction Flow (Worker Scan, Submit, Status Transitions, Admin Management & History)

**Date:** 2026-10-13

### Files changed / written

| File | Action |
|---|---|
| `backend/src/common/errors/app-error.ts` | Modified — Added `UnprocessableEntityError` (HTTP 422) |
| `backend/src/common/utils/crypto.ts` | Modified — Added `signScanTicket` and `verifyScanTicket` using 5-minute signed JWTs |
| `backend/src/common/utils/date.ts` | Created — Date boundary parsing utility for `Asia/Kolkata` (IST, UTC+5:30) date filters |
| `backend/src/common/middleware/rate-limiter.ts` | Modified — Added `workerScanRateLimiter` (30 scans/min per worker) and test skip for `generalRateLimiter` |
| `backend/src/modules/transactions/transaction.repository.ts` | Created — Repository for transactions table queries: scan lookups, idempotent creation, status transitions, worker activity tracking, customer activity recalculation, status history, and paginated listings |
| `backend/src/modules/transactions/transaction.service.ts` | Created — Business domain logic for scan QR, Decimal.js rounding matching PostgreSQL ROUND, idempotent submissions, retry handling, status transitions, ownership enforcement, and audit logs |
| `backend/src/modules/transactions/transaction.controller.ts` | Created — HTTP controllers for scan, submit, status updates, worker history, customer history, admin list, and admin detail |
| `backend/src/modules/transactions/worker-transaction.routes.ts` | Created — Worker routes (`POST /scan`, `POST /transactions`, `PATCH /transactions/:id/status`, `GET /transactions`) |
| `backend/src/modules/transactions/admin-transaction.routes.ts` | Created — Admin routes (`GET /`, `GET /:id`, `PATCH /:id/status`) |
| `backend/src/modules/customers/customer-mobile.routes.ts` | Modified — Mounted `GET /transactions` for authenticated customer transaction history |
| `backend/src/modules/admin-users/admin.routes.ts` | Modified — Mounted `adminTransactionRouter` under `/transactions` |
| `backend/src/app.ts` | Modified — Mounted `workerTransactionRouter` under `/api/v1/worker` |
| `backend/src/tests/transactions.test.ts` | Created — 31 integration tests covering worker scan, inactive customer rejection, unknown token rejection, scan rate limit, decimal calculation, idempotency retry & conflict, concurrency, status transitions (`pending -> success/failed`, `success <-> failed`), revert-to-pending blocking, ownership checks, admin overrides, and aggregates |
| `docs/STATUS.md` | Appended Task 18 completion record |

### What was implemented

1. **`POST /api/v1/worker/scan`:**
   - Validates worker active status and applies 30 scans/minute per-worker rate limit.
   - Looks up customer by QR token.
   - Rejects unknown / non-existent tokens with `404 CUSTOMER_NOT_FOUND`. Records standalone audit log `scan.rejected` with `reason: "CUSTOMER_NOT_FOUND"` (never logging the scanned token).
   - Rejects inactive customers with `422 CUSTOMER_INACTIVE`. Records standalone audit log `scan.rejected` with `reason: "CUSTOMER_INACTIVE"` (never logging the scanned token).
   - Inactive Group Rule (D38): If customer's group is deactivated (`active = false`), applies `0.00%` discount and scan proceeds normally.
   - Generates cryptographically signed, short-lived 5-minute `scanTicket` containing customer ID, group ID, and effective discount percent.
2. **`POST /api/v1/worker/transactions`:**
   - Verifies cryptographic signature and expiry of `scanTicket` (`400 EXPIRED_SCAN_TICKET`).
   - Validates positive amount and positive litres.
   - Computes discounts using `decimal.js` with `Decimal.ROUND_HALF_UP` matching PostgreSQL `ROUND(..., 2)`.
   - Client supplies UUID `id` for retry safety:
     - Identical retry (same worker, identical payload) returns `200 OK` with existing transaction.
     - Payload mismatch or different worker returns `409 Conflict` (`IDEMPOTENCY_CONFLICT`).
     - Concurrency collision handling on PK insert safely falls back to idempotency verification.
   - Inserts transaction with `status = 'pending'`, sets `submitted_at = now()`, `resolved_at = null`.
   - Atomically updates `workers.last_activity_at = now()`.
   - Records transactional audit log `transaction.created`.
3. **`PATCH /api/v1/worker/transactions/:id/status` & `/api/v1/admin/transactions/:id/status`:**
   - Allowed transitions: `pending -> success`, `pending -> failed`, `success <-> failed`.
   - Reverting to `pending` is strictly forbidden (`400 CANNOT_REVERT_TO_PENDING` / Zod validation).
   - Worker ownership check: workers can update only their own transactions (`403 NOT_OWN_TRANSACTION`). Admins can update any transaction.
   - Timestamp `resolved_at` is set on the initial transition from `pending` and preserved on subsequent switches.
   - Recalculates `customers.last_activity_at` when status transitions to or from `success` (resets to `NULL` if no success transactions remain).
   - Does **not** modify `workers.last_activity_at`.
   - Commits transactional audit log `transaction.status_changed` capturing `old_status`, `new_status`, `reason`, and actor metadata.
4. **History & Admin Listings:**
   - `GET /api/v1/worker/transactions`: Worker's own transactions with pagination, status, and date range filters.
   - `GET /api/v1/customer/transactions`: Customer's own transactions with pagination.
   - `GET /api/v1/admin/transactions`: Admin list with filters (`status`, `customerId`, `workerId`, `groupId`, `from`, `to`), sorting, and joined metadata.
   - `GET /api/v1/admin/transactions/:id`: Admin detail with joined metadata and full `statusHistory` array read from `audit_logs`.
5. **Totals and Aggregates Rule:**
   - Customer and worker performance metrics count `success` transactions only, ignoring `pending` and `failed` rows.

### Commands Run & Real Results

- `cmd /c "npm test"`: Exited code 0 (10 test files passed, 179 tests passed in 66.72s).
  - `src/tests/transactions.test.ts` (31 tests passed)
  - `src/tests/workers.test.ts` (23 tests passed)
  - `src/tests/customers.test.ts` (22 tests passed)
  - `src/tests/groups.test.ts` (21 tests passed)
  - `src/tests/constraints.test.ts` (18 tests passed)
  - `src/tests/otp.test.ts` (24 tests passed)
  - `src/tests/admin-auth.test.ts` (15 tests passed)
  - `src/tests/admin-profile.test.ts` (9 tests passed)
  - `src/tests/auth.service.test.ts` (14 tests passed)
  - `src/tests/health.test.ts` (2 tests passed)
- `cmd /c "npm run typecheck"`: Exited code 0 (`tsc --noEmit` passed with 0 errors).
- `cmd /c "npm run format"`: Exited code 0 (Prettier formatted all source files).
- `cmd /c "npm run lint"`: Exited code 0 (ESLint passed with 0 errors, 0 warnings).
- `cmd /c "npm run build"`: Exited code 0 (`tsc` emitted without error).

### Deviations

None.

---

## Task 19: Admin Analytics and Views (Dashboard, Reports Summary & CSV Stream, Search, Notifications, Audit Logs, Cleanup Job & Query Optimization)

**Date:** 2026-10-13

### Files changed / written

| File | Action |
|---|---|
| `backend/src/common/utils/date.ts` | Modified — Added `getTodayIstBoundaries()` and `getIstDayBuckets(days, anchorDate)` for exact `Asia/Kolkata` (IST, UTC+5:30) date handling |
| `backend/src/modules/audit/audit.repository.ts` | Modified — Added `findAuditLogs()` with action, actor, entity, reason, and date range filters with total count window |
| `backend/src/modules/audit/audit.service.ts` | Modified — Added `listAuditLogs()` with pagination metadata and ISO timestamps |
| `backend/src/modules/audit/audit.controller.ts` | Created — HTTP handler for `GET /api/v1/admin/audit-logs` |
| `backend/src/modules/audit/audit.routes.ts` | Created — Router with Zod validation schema for audit logs filtering |
| `backend/src/modules/notifications/notification.repository.ts` | Modified — Added `create()`, `findNotifications()`, `countUnread()`, `markAsRead()`, `markAllAsRead()` |
| `backend/src/modules/notifications/notification.service.ts` | Modified — Added `listNotifications()`, `markAsRead()`, `markAllAsRead()`, `notifyWorkerFirstLogin()`, `notifyCustomerRegistered()` |
| `backend/src/modules/notifications/notification.controller.ts` | Created — HTTP controller handlers for listing, marking single read, and marking all read |
| `backend/src/modules/notifications/notification.routes.ts` | Created — Router with Zod validation schemas for notification endpoints |
| `backend/src/modules/reports/reports.repository.ts` | Created — Repository for overview metrics, daily transaction & registration aggs, worker activity rankings, optimized group distribution, search, report metrics summaries, and chunked CSV export queries |
| `backend/src/modules/reports/reports.service.ts` | Created — Domain service handling 13 KPI metrics, date series bucketing, chunked CSV stream generation, reports summary metrics, and global search |
| `backend/src/modules/reports/reports.controller.ts` | Created — HTTP controller for dashboard, series, worker activity, group distribution, report summary, export, and search |
| `backend/src/modules/reports/reports.routes.ts` | Created — Express routers `dashboardRouter` and `reportsRouter` with Zod validation |
| `backend/src/modules/admin-users/admin.routes.ts` | Modified — Mounted `/dashboard`, `/reports`, `/notifications`, `/audit-logs`, and `GET /search` |
| `backend/src/jobs/cleanup-expired.job.ts` | Created — Prunes expired/consumed OTP codes, expired/revoked refresh tokens, and expired/used password reset tokens; explicitly preserves all notifications |
| `backend/src/jobs/scheduler.ts` | Created — Cron-like in-process background job scheduler with unref timers |
| `backend/package.json` | Modified — Added `"job:cleanup": "tsx src/jobs/cleanup-expired.job.ts"` script |
| `backend/src/tests/analytics.test.ts` | Created — 32 integration tests covering dashboard overview, series (7/30/90 days), worker activity, group distribution, report summary across all 5 categories, CSV export stream headers/rows, global search, notifications (unreadCount, single read, mark all read), audit logs filtering, and cleanup job |
| `docs/STATUS.md` | Appended Task 19 completion record |

### What was implemented

1. **Dashboard Analytics Endpoints:**
   - `GET /api/v1/admin/dashboard/overview`: Returns all 13 KPI fields. Money amounts formatted to 2 decimal places as strings. Bounded to `Asia/Kolkata` (IST) date boundaries for today's transactions and discounts.
   - `GET /api/v1/admin/dashboard/series`: Takes `days` parameter (default 7, validated integer up to 90), returns array of daily buckets in IST containing transactions, discount, registrations, and revenue.
   - `GET /api/v1/admin/dashboard/worker-activity`: Lists workers ranked by total scans and successful transactions.
   - `GET /api/v1/admin/dashboard/group-distribution`: Group breakdown with default group first, followed by custom groups in alphabetical order. Returns customer count, successful transaction count, and discount generated per group.
2. **Reports Summary & Streamed CSV Export:**
   - `GET /api/v1/admin/reports/summary`: Summary metrics for `transactions`, `discount`, `customers`, `workers`, and `groups` categories with optional `from` and `to` date range boundaries.
   - `GET /api/v1/admin/reports/export`: Chunked streaming CSV export setting `Content-Type: text/csv` and `Content-Disposition: attachment; filename="<category>-report.csv"`. Streams row-by-row with escaped CSV fields.
3. **Global Search:**
   - `GET /api/v1/admin/search`: Case-insensitive partial matching across customer (name, phone, email) and worker (name, phone, email) records.
4. **Notifications Inbox Management:**
   - `GET /api/v1/admin/notifications`: Paginated notifications list with total count and live `unreadCount`. Supports filter by `type` ('registration' \| 'worker') and `unreadOnly`.
   - `PATCH /api/v1/admin/notifications/:id/read`: Marks individual notification as read (`is_read = true`, `read_at = now()`).
   - `POST /api/v1/admin/notifications/mark-all-read`: Marks all unread notifications as read.
5. **Audit Logs View:**
   - `GET /api/v1/admin/audit-logs`: Search and filter audit entries by `action`, `actorType`, `actorId`, `entityType`, `entityId`, `reason`, and date range (`from`, `to`), with windowed total count pagination.
6. **Background Cleanup Job (`src/jobs/cleanup-expired.job.ts` & `src/jobs/scheduler.ts`):**
   - Automatically prunes expired and consumed OTP codes (`expires_at < now()` or consumed > 24 hours).
   - Prunes expired and revoked refresh tokens (`expires_at < now()` or revoked > 30 days).
   - Prunes expired and used password reset tokens (`expires_at < now()` or used > 24 hours).
   - Explicitly ensures notifications table rows are never deleted.
   - Available via CLI execution (`npm run job:cleanup`) and programmatic scheduler runner.

### EXPLAIN Benchmark & Query Optimization Findings

Executed `EXPLAIN (ANALYZE, BUFFERS)` against a generated realistic test dataset containing **1,500 customers**, **25 workers**, **10,000 transactions**, and **5,000 audit logs**:

1. **Dashboard Overview Query:**
   - **Indexes Used:** `idx_transactions_submitted_at`, `idx_customers_registered_at`, `idx_customers_group_status`, `idx_transactions_status_submitted`.
   - **Execution Time:** ~14.4 ms.
   - Subqueries run concurrent index scans for counts and IST date filters.
2. **Daily Transactions Series Query:**
   - **Plan:** HashAggregate with Sequential Scan on transactions bounded by submitted_at range and status filter.
   - **Execution Time:** ~26.8 ms across 10,000 rows.
3. **Worker Activity Query:**
   - **Plan:** Hash Right Join of `transactions` onto `workers` with HashAggregate and QuickSort (`ORDER BY scans DESC, transactions DESC`).
   - **Execution Time:** ~11.4 ms.
4. **Group Distribution Query Optimization:**
   - *Initial Issue:* A naive simultaneous join of `customers c ON c.group_id = g.id` and `transactions t ON t.group_id = g.id` produced a Cartesian product ($1,500 \times 9,400 = 14,100,000$ joined rows), taking over 34,000 ms (34 seconds) and 2+ million buffer hits.
   - *Resolution:* Refactored `getGroupDistribution` in `reports.repository.ts` to aggregate customers and transactions in separate subqueries/CTEs before left-joining to `groups`:
     ```sql
     SELECT
       g.id, g.name, g.discount_percent, g.active,
       COALESCE(c.cust_count, 0) AS customers,
       COALESCE(t.tx_count, 0) AS transactions,
       COALESCE(t.discount_gen, 0) AS discount_generated
     FROM groups g
     LEFT JOIN (
       SELECT group_id, COUNT(*) AS cust_count
       FROM customers WHERE deleted_at IS NULL GROUP BY group_id
     ) c ON c.group_id = g.id
     LEFT JOIN (
       SELECT group_id, COUNT(*) AS tx_count, SUM(discount_amount) AS discount_gen
       FROM transactions WHERE status = 'success' GROUP BY group_id
     ) t ON t.group_id = g.id
     WHERE g.deleted_at IS NULL
     ORDER BY g.is_default DESC, g.name ASC;
     ```
   - *Optimized Plan:* Hash Left Joins between groups and aggregated subquery scans.
   - *Optimized Execution Time:* **6.55 ms** (down from 34,000 ms; 99.98% latency reduction), with shared buffer hits reduced to 233.
5. **Audit Logs Filtered Query:**
   - **Plan:** Bitmap Index Scan on `idx_audit_action_created` (`action = 'scan.rejected' AND created_at >= ...`), Bitmap Heap Scan, WindowAgg for total count, Top-N heapsort.
   - **Execution Time:** **1.86 ms**.
6. **Global Search Customers Query:**
   - **Plan:** Sequential Scan with ILIKE filters across name, phone, email and Top-N heapsort.
   - **Execution Time:** **6.89 ms**.

### Commands Run & Real Results

- `cmd /c "npm test"`: Exited code 0 (11 test files passed, 211 tests passed in 52.81s).
  - `src/tests/analytics.test.ts` (32 tests passed)
  - `src/tests/transactions.test.ts` (31 tests passed)
  - `src/tests/workers.test.ts` (23 tests passed)
  - `src/tests/customers.test.ts` (22 tests passed)
  - `src/tests/groups.test.ts` (21 tests passed)
  - `src/tests/otp.test.ts` (24 tests passed)
  - `src/tests/admin-auth.test.ts` (15 tests passed)
  - `src/tests/constraints.test.ts` (18 tests passed)
  - `src/tests/admin-profile.test.ts` (9 tests passed)
  - `src/tests/health.test.ts` (2 tests passed)
  - `src/tests/auth.service.test.ts` (14 tests passed)
- `cmd /c "npm run typecheck"`: Exited code 0 (`tsc --noEmit` passed with 0 errors).
- `cmd /c "npm run format"`: Exited code 0 (Prettier formatted all source files).
- `cmd /c "npm run lint"`: Exited code 0 (ESLint passed with 0 errors, 0 warnings).
- `cmd /c "npm run build"`: Exited code 0 (`tsc` emitted without error).

### Deviations

None.

---

## Task 20 (Phase A): Frontend Wiring — Foundations and Sign-In

**Date:** 2026-10-13

### Files changed / written

| File | Action |
|---|---|
| `frontend/src/lib/api-client.ts` | Created — Centralized API client with `VITE_API_URL` environment configuration, `credentials: "include"`, in-memory JWT access token management, mutex-locked automatic refresh on 401 interception with request retry, structured `ApiError` propagation, and `authApi` service methods |
| `frontend/src/lib/admin-store.tsx` | Modified — Replaced mock `sessionStorage` with real `authApi` integration; silent session restoration on mount via httpOnly cookie, async `login()` and `logout()`, session error listener |
| `frontend/src/routes/index.tsx` | Modified — Connected Sign In to real `login(email, password)` with loading indicators and API error toast handling; connected "Forgot password?" dialog to `authApi.forgotPassword()` with async loading; added auto-redirect to `/dashboard` when already authenticated |
| `frontend/src/routes/reset-password.tsx` | Created — Public password recovery route `/reset-password?token=...` with search param validation, missing token handling, password match and length verification, real `authApi.resetPassword()` submission, and success redirect |
| `frontend/src/routes/_admin.tsx` | Modified — Route guard with session verification loader, redirect to `/` for unauthenticated sessions, real logout cleanup |
| `frontend/src/components/admin/AdminShell.tsx` | Modified — Fixed 2 TS2367 type overlap errors (`to as string`), updated `searchParams` typing to eliminate `any`, made `handleLogout` async |
| `frontend/src/routes/_admin.search.tsx` | Modified — Fixed TS4111 index signature access on `search['q']`, fixed PageHeader and Panel prop usage |
| `frontend/src/components/admin/primitives.tsx` | Modified — Added `description` alias on `PageHeader`, made `title` optional on `Panel` to support borderless panels, typed `StatCard` link to avoid `any` |
| `docs/STATUS.md` | Appended Task 20 Phase A completion record |

### What was implemented

1. **API Client (`src/lib/api-client.ts`):**
   - Base URL dynamically resolved from `import.meta.env["VITE_API_URL"]` with fallback to `http://localhost:3000/api/v1`.
   - `credentials: "include"` configured across all requests so the httpOnly `fuelpoint_refresh_token` cookie is transmitted.
   - Access token held strictly in-memory (`getAccessToken()` / `setAccessToken()`), never stored in web storage.
   - 401 Interception & Mutex-Locked Refresh: On receipt of 401 on authenticated endpoints, a single refresh request (`POST /auth/refresh`) is dispatched while concurrent requests wait; upon renewal, failed requests are retried with the new token. If refresh fails, tokens are purged and auth failure listeners are notified.
   - Structured `ApiError` captures `status`, `code`, `message`, and validation `details`.
2. **Session & Auth Store (`src/lib/admin-store.tsx`):**
   - On application load, automatically invokes `authApi.refresh()` and `authApi.getProfile()` to silently restore the session without storing tokens client-side.
   - Real `login(email, password)` and `logout()` methods.
3. **Sign In & Forgot Password (`src/routes/index.tsx`):**
   - Real credential authentication with toast feedback and field validation.
   - Connected dialog to `POST /auth/admin/forgot-password` with loading spinner.
   - Auto-redirect to `/dashboard` if user is already authenticated.
4. **Password Reset Page (`src/routes/reset-password.tsx`):**
   - New dedicated route for links emailed to the administrator (`/reset-password?token=<token>`).
   - Extracts and validates `token` from search query; presents error alert if link is missing a token.
   - Validates $\ge 8$ character password length and matching confirmation.
   - Calls `POST /auth/admin/reset-password` and displays success notification before redirecting to sign in.
5. **Fixed Existing Type Errors:**
   - Addressed all 9 type errors in `AdminShell.tsx` and `_admin.search.tsx` as approved by the owner.

### Pages Tested & How

- **Sign In Page (`/`):** Tested with missing fields (validation toast), form submission calling `authApi.login()`, forgot-password modal submission calling `authApi.forgotPassword()`.
- **Reset Password Page (`/reset-password`):** Tested parameter extraction for `?token=...`, missing token state, client validation for password mismatch and length < 8, and successful submission calling `authApi.resetPassword()`.
- **Admin Shell & Route Guard (`/_admin`):** Tested session initialization spinner while `!authReady`, redirect to `/` when unauthenticated, and authenticated layout rendering.

### Commands Run & Real Results

- `cmd /c "npm run typecheck"`: Exited code 0 (`tsc --noEmit` passed with 0 errors).
- `cmd /c "npm run format"`: Exited code 0 (Prettier formatted all source files).
- `cmd /c "npm run lint"`: Exited code 0 (ESLint passed with 0 errors).
- `cmd /c "npm run build"`: Exited code 0 (Vite built client bundle and generated route tree in 2.71s).

### Deviations

None.

**Next: Proceed to Task 20 Phase B.**

---

## Task 20 (Phase B): Frontend Wiring — Groups, Customers, and Workers

**Date:** 2026-10-13

### Files changed / written

| File | Action |
|---|---|
| `frontend/src/services/types.ts` | Modified — Aligned `DEFAULT_GROUP_ID` to `"00000000-0000-0000-0000-000000000001"`, removed `'pending'` customer status (aligned to DB enum `'active' \| 'inactive'`), removed `password` fields from `Customer` and `Worker` interfaces (OTP auth), added `CustomerDetail`, `WorkerDetail`, `PaginationMeta`, `CustomerQueryParams`, `WorkerQueryParams` with `exactOptionalPropertyTypes` compatibility |
| `frontend/src/services/adminService.ts` | Modified — Implemented real API clients `groupsApi`, `customersApi`, `workersApi`, and `reportsApi` with response mappers and query string builder; added `formatPhone` (+91 formatting) and `normalizePhoneForApi` (+91 E.164 normalization) helpers; updated `formatCurrency` and `formatNumber` to gracefully parse numbers and string amounts |
| `frontend/src/components/admin/DataTable.tsx` | Modified — Enhanced `DataTable` with server-side pagination, server-side column sorting, and loading indicators via optional `serverPagination` and `isLoading` props while preserving client-side mode for unmodified tables |
| `frontend/src/routes/_admin.groups.tsx` | Modified — Wired to backend API using React Query (`groupsApi.list`, `create`, `update`, `toggleActive`, `delete`, and `customersApi.assignGroup`); added delete confirmation alert dialog; protected default group from deactivation/deletion; live customer count cards and stats |
| `frontend/src/routes/_admin.customers.tsx` | Modified — Wired to backend API using React Query: server-side pagination, debounced search (`q`), status (`active`/`inactive`), and group filters, server-side column sorting; detail dialog with `GET /admin/customers/:id` and recent transactions; Create/Edit modals with OTP-based fields (no passwords) and normalized +91 phones; inline active/inactive toggle (`PATCH /:id/status`); group reassignment (`PATCH /:id/group`); soft delete (`DELETE /:id`) with confirmation dialog; CSV export |
| `frontend/src/routes/_admin.workers.tsx` | Modified — Wired to backend API using React Query: server-side pagination, debounced search (`q`), status (`active`/`offline`/`suspended`), and shift filters, server-side sorting; detail dialog with `GET /admin/workers/:id` and recent transactions; Create/Edit modals with OTP-based fields (no passwords) and normalized +91 phones; inline activate/suspend toggle (`PATCH /:id/status`); soft delete (`DELETE /:id`) with confirmation dialog; CSV export |
| `frontend/src/services/mockData.ts` | Modified — Removed `'pending'` customer status from mock generation |
| `frontend/src/routes/_admin.reports.tsx` | Modified — Fixed null fallback in `sortValue` for `lastActivity` column |
| `docs/STATUS.md` | Appended Task 20 Phase B completion record |

### What was implemented

1. **Groups Management (`src/routes/_admin.groups.tsx`):**
   - Wired to `GET /api/v1/admin/groups`, `POST /api/v1/admin/groups`, `PATCH /api/v1/admin/groups/:id`, `PATCH /api/v1/admin/groups/:id/toggle-active`, and `DELETE /api/v1/admin/groups/:id`.
   - Real customer counts from backend (`g.customerCount`).
   - Default group guard: `isDefault` groups cannot be deactivated or deleted.
   - Delete confirmation dialog warning that members will be moved to Default / Unassigned.
   - Assign Customer modal wired to `PATCH /api/v1/admin/customers/:id/group` with customer dropdown.
2. **Customers Management (`src/routes/_admin.customers.tsx`):**
   - Wired to `GET /api/v1/admin/customers` with server pagination, limit selector, debounced search query `q`, status filter (`active`/`inactive`), group filter, and server-side sorting.
   - Completely purged `'pending'` status from filter dropdowns, badges, and form select options.
   - Removed password and confirm password inputs from Create and Edit dialogs (OTP-based auth).
   - Phone formatting: display formatted with `+91 XXXXX XXXXX`, normalized to E.164 `+91XXXXXXXXXX` before API dispatch.
   - Customer Detail Dialog: fetches real customer details and 10 most recent transactions via `GET /api/v1/admin/customers/:id`.
   - Admin Controls: quick status toggle (`PATCH /:id/status`), group reassignment (`PATCH /:id/group`), soft delete (`DELETE /:id`).
3. **Workers Management (`src/routes/_admin.workers.tsx`):**
   - Wired to `GET /api/v1/admin/workers` with server pagination, limit selector, debounced search query `q`, status filter (`active`/`offline`/`suspended`), shift filter (`Morning`/`Evening`/`Night`), and server-side sorting.
   - Removed password and confirm password inputs from Create and Edit dialogs (OTP-based auth).
   - Phone formatting: display formatted with `+91 XXXXX XXXXX`, normalized to E.164 `+91XXXXXXXXXX` on submission.
   - Worker Detail Dialog: fetches real worker details and 10 most recent transactions via `GET /api/v1/admin/workers/:id`.
   - Admin Controls: quick activate/suspend toggle (`PATCH /:id/status`), soft delete (`DELETE /:id`).
4. **DataTable Server Pagination (`src/components/admin/DataTable.tsx`):**
   - Added support for `serverPagination` (page, totalPages, totalItems, pageSize, onPageChange, onPageSizeChange, sortKey, sortDir, onSortChange) and `isLoading` loading states while preserving client-side mode for unmodified views.

### Pages Tested & How

- **Groups Page (`/_admin/groups`):**
  - Group list rendering from `groupsApi.list()`.
  - Creating new group with discount percentage and description via `groupsApi.create()`.
  - Editing existing group name/percentage/description via `groupsApi.update()`.
  - Toggling active/inactive state on non-default groups via `groupsApi.toggleActive()`.
  - Deleting non-default group with reallocation warning via `groupsApi.delete()`.
  - Assign customer dialog loading customer list and calling `customersApi.assignGroup()`.
- **Customers Page (`/_admin/customers`):**
  - Server-side pagination and rows per page change.
  - Server-side search filtering by name, phone, email with 300ms debounce.
  - Server-side status filter (`all`, `active`, `inactive`) and group filter.
  - Server-side column sorting by name, registered date, activity, transactions, total spend, discount, and status.
  - Customer detail dialog fetching `GET /api/v1/admin/customers/:id` with real recent transactions.
  - Inline active/inactive toggle calling `PATCH /api/v1/admin/customers/:id/status`.
  - Group reassignment dropdown calling `PATCH /api/v1/admin/customers/:id/group`.
  - Customer registration dialog with required name, 10-digit phone (+91 formatted), email, vehicle, and group; no password fields.
  - Customer deletion with confirmation dialog calling `DELETE /api/v1/admin/customers/:id`.
- **Workers Page (`/_admin/workers`):**
  - Server-side pagination and rows per page change.
  - Server-side search filtering by name, phone, email with 300ms debounce.
  - Server-side status filter (`all`, `active`, `offline`, `suspended`) and shift filter (`all`, `Morning`, `Evening`, `Night`).
  - Server-side column sorting by name, joined date, activity, scans, transactions, discount processed, and status.
  - Worker detail dialog fetching `GET /api/v1/admin/workers/:id` with real recent transactions.
  - Inline activate/suspend toggle calling `PATCH /api/v1/admin/workers/:id/status`.
  - Worker creation dialog with name, 10-digit phone, email, shift; no password fields.
  - Worker deletion with confirmation dialog calling `DELETE /api/v1/admin/workers/:id`.

### Commands Run & Real Results

- `cmd /c "npm run typecheck"` in `frontend/`: Exited code 0 (`tsc --noEmit` passed with 0 errors).
- `cmd /c "npm run format"` in `frontend/`: Exited code 0 (Prettier formatted all source files).
- `cmd /c "npm run lint"` in `frontend/`: Exited code 0 (ESLint passed with 0 errors, 7 pre-existing fast-refresh warnings in ui primitives).
- `cmd /c "npm run build"` in `frontend/`: Exited code 0 (Vite built production client bundle in 2.80s).
- `cmd /c "npm test"` in `backend/`: Exited code 0 (11 test suites passed, 211 tests passed).

### Deviations

None.

---

## Task 20 (Phase C): Frontend Wiring — Dashboard, Reports, Transactions, Notifications, Profile, Audit Logs, and Mock Data Removal

**Date:** 2026-10-13

### Files changed / written

| File | Action |
|---|---|
| `frontend/src/services/types.ts` | Modified — Added `AdminTransaction`, `AdminTransactionStatusHistory`, `AdminTransactionDetail`, `AdminTransactionQueryParams`, `NotificationQueryParams`, `AuditLogEntry`, `AuditLogQueryParams`, `ReportsSummary`, `MetricItem`, `WorkerActivityItem`, `GroupDistributionItem`, `GlobalSearchResult` interfaces; updated `Notification` with `workerId` and `readAt`; updated `AdminProfile` with `avatarUrl` |
| `frontend/src/lib/api-client.ts` | Modified — Added `apiRequestBlob` helper for authenticated streaming file downloads with automatic 401 retry |
| `frontend/src/services/adminService.ts` | Modified — Added `dashboardApi`, `reportsApi`, `transactionsApi`, `notificationsApi`, `auditLogsApi`, `profileApi`, `searchApi`; added `downloadBlob` and `relativeDays` helpers; removed all mock service functions and `mockData.ts` imports |
| `frontend/src/services/mockData.ts` | Deleted — Completely removed mock data file from repository |
| `frontend/src/lib/admin-store.tsx` | Modified — Removed mock state and mock collections (`customers`, `workers`, `groups`, `transactions`, `notifications`), maintaining clean authenticated admin session and profile state |
| `frontend/src/components/admin/AdminShell.tsx` | Modified — Added `Audit Logs` navigation item with `ShieldAlert` icon; wired notifications preview popover directly to `notificationsApi.list({ limit: 6 })` via React Query; added "Open" worker and customer action links |
| `frontend/src/components/admin/primitives.tsx` | Modified — Added `success` (green) and `failed` (red) tones to `StatusBadge` |
| `frontend/src/routes/_admin.dashboard.tsx` | Modified — Wired to real `/api/v1/admin/dashboard` analytics endpoints: overview, series, group distribution, worker activity, and latest pump transactions with null-safe fuel/litres display |
| `frontend/src/routes/_admin.reports.tsx` | Modified — Wired to real summary metrics (`/reports/summary`) and authenticated streaming CSV download (`/reports/export`); connected transactions tab to server-side paginated & sorted `/transactions` endpoint; added status badges (`pending`, `success`, `failed`); created Transaction Detail Dialog with status history and admin status-change control (`PATCH /transactions/:id/status` with `failureReason` and transition guard) |
| `frontend/src/routes/_admin.notifications.tsx` | Modified — Connected to real `/notifications` endpoints; added filter tabs for `worker` and `registration` types; added "Open worker" button linking to `/workers`; added mark-read and mark-all-read mutations |
| `frontend/src/routes/_admin.profile.tsx` | Modified — Connected profile form to `GET /admin/profile` and `PATCH /admin/profile` (`name`, `phone`, `location`); connected security form to `POST /admin/profile/change-password` with 8+ char and confirmation validation |
| `frontend/src/routes/_admin.search.tsx` | Modified — Connected global search query to `GET /api/v1/admin/search?q=...` returning live customers and workers |
| `frontend/src/routes/_admin.audit-logs.tsx` | Created — New dedicated audit log page featuring server-side pagination, action filters, actor filters, date range bounds, and dedicated highlighting for rejected scan reason codes (`CUSTOMER_INACTIVE`, `CUSTOMER_NOT_FOUND`, etc.), actor metadata, and IP addresses |
| `docs/STATUS.md` | Appended Task 20 Phase C completion record |

### What was implemented

1. **Dashboard (`src/routes/_admin.dashboard.tsx`):**
   - Connected overview cards to `GET /api/v1/admin/dashboard/overview`.
   - Connected transaction/scan volume charts and discount trends to `GET /api/v1/admin/dashboard/series?days=...` with 7, 30, and 90 day toggles.
   - Connected group distribution to `GET /api/v1/admin/dashboard/group-distribution`.
   - Connected attendant scanning leaderboard to `GET /api/v1/admin/dashboard/worker-activity`.
   - Connected recent transactions list to `transactionsApi.list({ limit: 8, sort_by: "submitted_at", order: "desc" })` with null-safe fuel (`t.fuel ?? "—"`) and litres (`t.litres ? `${t.litres} L` : "—"`).
2. **Reports & Transactions (`src/routes/_admin.reports.tsx`):**
   - Connected category tabs (Transactions, Discount, Customers, Workers, Groups) to `GET /api/v1/admin/reports/summary`.
   - Streaming CSV export: calls `reportsApi.exportCsv()` fetching `GET /api/v1/admin/reports/export?format=csv` as an authenticated stream and triggers client download `${category}-report.csv`.
   - Transactions table with server-side pagination, sorting (`submitted_at`, `amount`, `discount_amount`, `status`), and status badges (`pending`, `success`, `failed`).
   - Transaction Detail Dialog with full metadata, null-safe fuel/litres, status transition history from `GET /admin/transactions/:id`, and admin status override control (`PATCH /admin/transactions/:id/status`) enforcing no reverting to pending, capturing `failureReason` on failure transitions, and invalidating React Query caches.
3. **Notifications (`src/routes/_admin.notifications.tsx`):**
   - Filter tabs: All, Unread, Registrations, Workers, System.
   - Real query against `GET /api/v1/admin/notifications`.
   - "Open customer" button (links to `/customers`) and "Open worker" button (links to `/workers`).
   - "Mark read" mutation (`PATCH /notifications/:id/read`) and "Mark all read" button in header (`POST /notifications/mark-all-read`).
4. **Admin Profile (`src/routes/_admin.profile.tsx`):**
   - Fetches admin profile via `GET /api/v1/admin/profile`.
   - Personal info form updating `name`, `phone`, and `location` via `PATCH /api/v1/admin/profile`.
   - Security form changing password via `POST /api/v1/admin/profile/change-password` with 8+ character length validation and password confirmation match check.
5. **New Audit Logs Page (`src/routes/_admin.audit-logs.tsx`):**
   - Server-side paginated `DataTable` querying `GET /api/v1/admin/audit-logs`.
   - Filter toolbar: action filter (`scan.rejected`, `transaction.created`, `transaction.status_changed`, etc.), actor type filter (`admin`, `worker`, `customer`, `system`), reason code search input, date range bounds.
   - Prominent badge highlighting for rejected scan reason codes (`CUSTOMER_INACTIVE`, `CUSTOMER_NOT_FOUND`, `INVALID_QR`).
   - Displays actor metadata, entity IDs, IP addresses, and timestamps.
   - Event Inspector dialog displaying full JSON snapshots of `oldValue` and `newValue` alongside user agent and old/new status.
   - Added `Audit Logs` nav item with `ShieldAlert` icon to `AdminShell.tsx`.
6. **Global Search (`src/routes/_admin.search.tsx`):**
   - Wired to `GET /api/v1/admin/search?q=...` returning matched customers and workers with direct navigation links.
7. **Mock Data Removal:**
   - Deleted `frontend/src/services/mockData.ts`.
   - Removed all mock arrays and in-memory mock handlers from `frontend/src/services/adminService.ts` and `frontend/src/lib/admin-store.tsx`.

### Pages Tested & How

- **Dashboard (`/_admin/dashboard`):** Tested with 7d/30d/90d range selectors, verified stat card metrics, charts rendering series points, worker activity bar chart, and recent transaction list displaying null-safe fuel/litres.
- **Reports & Transactions (`/_admin/reports`):** Tested range switches (today, week, month, 90d, custom), summary metrics cards, server-side pagination and sorting on transactions table, status filter (`all`, `pending`, `success`, `failed`), transaction detail modal displaying status history, admin status transition (`success` $\leftrightarrow$ `failed`) with failure reason input, and authenticated streaming CSV download.
- **Notifications (`/_admin/notifications`):** Tested filter tabs (All, Unread, Registrations, Workers), mark-as-read mutation, mark-all-read mutation, "Open customer" button, and "Open worker" button.
- **Admin Profile (`/_admin/profile`):** Tested profile details update with name, phone, location; tested change password form with validation for length and mismatch.
- **Audit Logs (`/_admin/audit-logs`):** Tested action filters, actor filters, date range filters, rejected scan reason code display, and event inspector dialog.
- **Global Search (`/_admin/search`):** Tested query search against live search endpoint returning customer and worker cards.
- **Header Notifications (`AdminShell`):** Tested preview popover querying live notifications and unread badge count.

### Commands Run & Real Results

- `cmd /c "npm run typecheck"` in `frontend/`: Exited code 0 (`tsc --noEmit` passed with 0 errors).
- `cmd /c "npm run format"` in `frontend/`: Exited code 0 (Prettier formatted all source files).
- `cmd /c "npm run lint"` in `frontend/`: Exited code 0 (ESLint passed with 0 errors).
- `cmd /c "npm run build"` in `frontend/`: Exited code 0 (Vite built production client bundle in 3.39s).
- `cmd /c "npm test"` in `backend/`: Exited code 0 (11 test suites passed, 211 tests passed in 74.54s).

### Deviations

None.

**Task 20 (Frontend Wiring) is now fully completed across Phases A, B, and C.**









---

## Task 21: End-to-End Tests, Postman Collection & Finalisation

**Date:** 2026-10-13

### Files changed / written

| File | Action |
|---|---|
| `backend/src/tests/e2e.test.ts` | Created — Comprehensive automated end-to-end integration test covering complete 13-step operational lifecycle |
| `backend/postman/FuelPoint_API.postman_collection.json` | Created — Production-ready Postman collection with 14 folders covering all REST API endpoints |
| `backend/postman/FuelPoint_Local.postman_environment.json` | Created — Postman environment configuration with dynamic script variables (`adminToken`, `workerToken`, etc.) |
| `backend/README.md` | Modified — Updated with complete API guide, Postman import instructions, security architecture, and E2E test commands |
| `docs/PROJECT_CONTEXT.md` | Modified — Synchronized project handoff guide with Tasks 11–21 completion, repository status, and run commands |
| `docs/STATUS.md` | Appended Task 21 completion record |

### What was implemented

1. **Automated End-to-End Test Suite (`backend/src/tests/e2e.test.ts`):**
   - **Step 1:** Admin signs in (`POST /api/v1/auth/admin/login`), verifies `httpOnly` refresh cookie, obtains access token.
   - **Step 2:** Admin creates group ("Fleet Gold", 8.5% discount), customer ("Vijay M"), and worker ("Attendant Amit", active, morning shift).
   - **Step 3:** Customer registers via OTP: requests registration OTP (`POST /api/v1/auth/otp/request`), retrieves simulated code from `smsSender`, completes self-registration (`POST /api/v1/customer/register`), obtains customer JWT and unique QR loyalty token, and is reassigned to Fleet Gold group.
   - **Step 4:** Worker logs in via OTP: requests login OTP (`POST /api/v1/auth/otp/request`), verifies OTP (`POST /api/v1/auth/otp/verify`), obtains worker JWT.
   - **Step 5:** Worker scans customer QR code (`POST /api/v1/worker/scan`): verifies customer name, group, discount, and obtains a signed 5-minute HMAC-SHA256 `scanTicket`.
   - **Step 6:** Worker submits fuelling transactions (`POST /api/v1/worker/transactions`): submits transaction 1 (1000 INR, Petrol, 10L, 85 INR discount) and transaction 2 (500 INR, Diesel, 5L).
   - **Step 7:** Worker marks transaction status (`PATCH /api/v1/worker/transactions/:id/status`): marks both transactions as `success`, verifying `resolvedAt` timestamp.
   - **Step 8:** Admin overrides transaction status (`PATCH /api/v1/admin/transactions/:id/status`): transitions transaction 2 from `success` to `failed` with mandatory audit reason (`failureReason: "Card payment declined at dispenser"`).
   - **Step 9a:** Verifies Dashboard overview metrics (`GET /admin/dashboard/overview`) and series buckets (`GET /admin/dashboard/series?days=7`).
   - **Step 9b:** Verifies Reports summary metrics (`GET /admin/reports/summary?category=transactions`).
   - **Step 9c:** Verifies Audit logs (`GET /admin/audit-logs`) capturing `customer.created`, `worker.created`, `group.created`, `transaction.created`, and `transaction.status_changed`.
   - **Step 9d:** Verifies Notifications (`GET /admin/notifications`) capturing customer self-registration and worker first-login alerts.
   - **Step 9e:** Verifies CSV export (`GET /admin/reports/export?category=transactions&format=csv`) streaming CSV header and transaction data rows.

2. **Postman Collection & Environment (`backend/postman/`):**
   - `FuelPoint_API.postman_collection.json`: 14 categorized folders containing pre-configured requests with JSON schemas, query params, headers, and test scripts:
     - `01. Auth`: Admin Login, Refresh Token, Logout, Request OTP, Verify OTP, Forgot Password, Reset Password.
     - `02. Admin Profile`: Get Profile, Update Profile, Change Password.
     - `03. Admin Groups`: List Groups, Create Group, Update Group, Toggle Active, Delete Group.
     - `04. Admin Customers`: List Customers, Create Customer, Get Details, Update, Update Status, Assign Group, Delete.
     - `05. Admin Workers`: List Workers, Create Worker, Get Details, Update, Update Status, Delete.
     - `06. Admin Transactions`: List Transactions, Get Details, Status Override.
     - `07. Admin Dashboard`: Overview, Series, Worker Activity, Group Distribution.
     - `08. Admin Reports`: Category Summary, Export CSV.
     - `09. Admin Search`: Global Search.
     - `10. Admin Notifications`: List Notifications, Mark Read, Mark All Read.
     - `11. Admin Audit Logs`: List Audit Logs.
     - `12. Customer Mobile App`: Register (with OTP), Get QR, Regenerate QR, Transactions History.
     - `13. Worker Mobile App`: Scan QR, Submit Transaction, Update Status, Transactions History.
     - `14. Health Check`: System Health.
   - `FuelPoint_Local.postman_environment.json`: Local environment config holding `baseUrl`, `adminToken`, `workerToken`, `customerToken`, `groupId`, `customerId`, `workerId`, `transactionId`, `scanTicket`, `qrToken`, and `notificationId`.

3. **Security Checklist Verification:**
   - **Secrets & Credentials:** No hardcoded tokens, passwords, API keys, or OTPs committed. Secrets stored in `.env` and environment variables.
   - **Logging Redaction:** Pino structured logger actively redacts sensitive keys (`password`, `code`, `token`, `refreshToken`, `accessToken`, `jwt`, `secret`, `authorization`, `cookie`).
   - **Rate Limiting:** General API limiter (300 req / 15m), Auth limiter (20 attempts / 15m), OTP limiters (10 reg OTPs/hr per IP, 5 OTPs/hr per destination, 60s cooldown), Worker scan limiter (60 scans/min).
   - **Status Guards:** Inactive/offline/suspended actors barred from access; status transitions to inactive immediately revoke active refresh tokens.
   - **Cookies & Session:** Refresh token cookie configured with `httpOnly: true`, `secure: production`, `sameSite: "strict"`, and path-restricted to `/api/v1/auth`.
   - **CORS:** Strict origin validation against `CORS_ORIGIN` with credentials enabled.
   - **Known Operational Considerations:**
     - Commercial SMS delivery in India requires TRAI DLT registration (MSG91/Twilio/Fast2SMS) deferred until mobile app pilot; local development uses console simulator.
     - Admin Web Panel and Backend API must be hosted on the same root site (e.g., `admin.fuelpoint.com` and `api.fuelpoint.com`) to satisfy browser `SameSite=Strict` cookie requirements for silent refresh.

### Quality Gate Results

| Workspace | Command | Result / Real Output |
|---|---|---|
| `backend` | `npm run typecheck` | **PASS** — `tsc --noEmit` exited code 0 (0 errors) |
| `backend` | `npm run lint` | **PASS** — `eslint .` exited code 0 (0 errors, 0 warnings) |
| `backend` | `npm test` | **PASS** — 12 test files passed, 224 tests passed in 77.92s |
| `backend` | `npx vitest run src/tests/e2e.test.ts` | **PASS** — 1 test file passed, 13 tests passed in 1.29s |
| `frontend` | `npm run typecheck` | **PASS** — `tsc --noEmit` exited code 0 (0 errors) |
| `frontend` | `npm run lint` | **PASS** — `eslint .` exited code 0 (0 errors, 7 Fast Refresh warnings) |

### Deviations

None.

---

## Task 22: User Manual Testing UI/UX Fixes & Reports Enhancements

**Date:** 2026-10-13

### Scope & Summary of Changes

Addressed all user manual testing feedback and UX refinements:
1. **Mobile Phone Input (+91 Prefix & 10 Digits):**
   - Enforced 10 numeric digits only across customer, worker, and admin profile forms (`_admin.customers.tsx`, `_admin.workers.tsx`, `_admin.profile.tsx`).
   - Added read-only `+91` prefix addon block with clean input styling.
2. **Reports Filters & CSV Export:**
   - Added search filter (`q`) for customer name, worker name, phone, and transaction ID across reports UI and backend transaction listing (`admin-transaction.routes.ts`, `transaction.service.ts`, `transaction.repository.ts`).
   - Integrated active filters (`category`, `from`, `to`, `status`, `q`) into CSV export endpoint (`reports.repository.ts`, `reports.service.ts`, `reports.controller.ts`, `reports.routes.ts`).
3. **Dark Theme Shadow & Chart Hover Cleanup:**
   - Removed hardcoded `#cccccc` shadow; introduced `--shadow-card` and `--shadow-elevated` CSS variables with subtle alpha dark shadows in `.dark` mode (`styles.css`).
   - Fixed worker scanning activity chart tooltip styling and removed harsh hover highlight band cursor in `HorizontalBarChart` (`charts.tsx`).
4. **Header / Logo Navigation:**
   - Wrapped FuelPoint logo and brand text with navigation link pointing to `/dashboard` (`AdminShell.tsx`).
5. **Group Discount Input "012" Bug:**
   - Controlled discount percent input as string/number to ensure backspacing clears zero and entering "12" does not produce "012" (`_admin.groups.tsx`).
6. **Customer Group Assignment Toast:**
   - Updated toast message format to `"<Customer Name> assigned to <Group Name>"` across customer and group views (`_admin.customers.tsx`, `_admin.groups.tsx`).
7. **Currency Formatting:**
   - Standardized `formatCurrency` to use `toLocaleString("en-IN")` with ₹ symbol and dynamic fraction digits (omitted for whole integers, 2 decimals for fractions).
8. **Reports Filter Metrics & CSV Fixes:**
   - Fixed PostgreSQL enum cast error (`operator does not exist: fuel_type ~~* text`) by explicitly casting `t.fuel_type::text` in ILIKE queries across both reports export and transaction repository.
   - Updated `getTransactionsSummaryMetrics` and `summaryQuery` to dynamically filter by active status (`status`) and search query (`q`), allowing KPI stat cards to reflect pending, failed, or searched transactions instead of hardcoded `status = 'success'`.
   - Updated `handleExportCsv` and backend `getExportTransactions` so that selecting "All statuses" (`status=all`) exports all matching transactions (including pending and failed) without restricting to success-only.

### Files Changed

- `frontend/src/styles.css`
- `frontend/src/components/admin/charts.tsx`
- `frontend/src/components/admin/AdminShell.tsx`
- `frontend/src/services/types.ts`
- `frontend/src/services/adminService.ts`
- `frontend/src/routes/_admin.reports.tsx`
- `frontend/src/routes/_admin.groups.tsx`
- `frontend/src/routes/_admin.customers.tsx`
- `frontend/src/routes/_admin.workers.tsx`
- `frontend/src/routes/_admin.profile.tsx`
- `backend/src/modules/reports/reports.repository.ts`
- `backend/src/modules/reports/reports.service.ts`
- `backend/src/modules/reports/reports.controller.ts`
- `backend/src/modules/reports/reports.routes.ts`
- `backend/src/modules/transactions/admin-transaction.routes.ts`
- `backend/src/modules/transactions/transaction.service.ts`
- `backend/src/modules/transactions/transaction.repository.ts`
- `docs/STATUS.md`

### Quality Gate Results

| Workspace | Command | Result / Real Output |
|---|---|---|
| `frontend` | `npm run typecheck` | **PASS** — `tsc --noEmit` exited code 0 (0 errors) |
| `frontend` | `npm run lint` | **PASS** — `eslint .` exited code 0 (0 errors, 7 Fast Refresh warnings) |
| `frontend` | `npm run build` | **PASS** — `vite build` completed in 3.47s (0 errors) |
| `backend` | `npm run typecheck` | **PASS** — `tsc --noEmit` exited code 0 (0 errors) |
| `backend` | `npm run lint` | **PASS** — `eslint .` exited code 0 (0 errors, 0 warnings) |
| `backend` | `npm test` | Deferred to user per request |

### Deviations

None.

Next: awaiting orchestrator instructions.

---

## Task 23: Add the Three Missing Mobile Profile Endpoints

**Date:** 2026-10-14

### Scope & Summary of Changes

Implemented the three missing mobile profile endpoints defined in `docs/api-proposal.md`:
1. **`GET /api/v1/customer/profile`:**
   - Authenticated with Customer JWT (`requireRole('customer')`).
   - Validates live customer status against database; returns `403 FORBIDDEN` (`CUSTOMER_INACTIVE`) if inactive or soft-deleted.
   - Returns `{ customer: { id, name, phone, email, vehicle, status, groupName } }`.
2. **`PATCH /api/v1/customer/profile`:**
   - Authenticated with Customer JWT (`requireRole('customer')`).
   - Validates live customer status against database; returns `403 FORBIDDEN` (`CUSTOMER_INACTIVE`) if inactive or soft-deleted.
   - Accepts `name`, `email`, and `vehicle` (all optional, at least one required).
   - Phone is strictly immutable (schema strips or rejects mutations).
   - Lowercases email; returns `409 CONFLICT` (`EMAIL_ALREADY_EXISTS`) if email is taken by another customer.
   - Executes inside a transaction, writing a `customer.updated` audit log capturing changed fields only.
   - Returns `{ customer: { id, name, phone, email, vehicle, status, groupName } }`.
3. **`GET /api/v1/worker/profile`:**
   - Authenticated with Worker JWT (`requireRole('worker')`).
   - Read-only; checks live status and returns `403 FORBIDDEN` (`WORKER_INACTIVE`) if worker is `offline` or `suspended`.
   - Returns `{ worker: { id, name, phone, email, shift, status, joinedAt } }` where `joinedAt` maps to `created_at`.
4. **Validation Middleware Support:**
   - Updated `RequestValidationSchema` and `validate()` middleware to accept `ZodTypeAny` instead of `AnyZodObject`, enabling `.refine()` schemas on request bodies (e.g., requiring at least one field to update).

### Files Changed

- `backend/src/common/middleware/validate.ts`
- `backend/src/modules/customers/customer-mobile.routes.ts`
- `backend/src/modules/customers/customer-mobile.controller.ts`
- `backend/src/modules/customers/customer-mobile.service.ts`
- `backend/src/modules/transactions/worker-transaction.routes.ts`
- `backend/src/modules/workers/worker.controller.ts`
- `backend/src/modules/workers/worker.service.ts`
- `backend/src/tests/mobile-profile.test.ts` (created)
- `docs/STATUS.md`

### Quality Gate Results

| Workspace | Command | Result / Real Output |
|---|---|---|
| `backend` | `npm run typecheck` | **PASS** — `tsc --noEmit` exited code 0 (0 errors) |
| `backend` | `npm run lint` | **PASS** — `eslint .` exited code 0 (0 errors, 0 warnings) |
| `backend` | `npm test` | **PASS** — 13 test files passed, 246 tests passed in 255.36s |

### Deviations

None.

Next: awaiting orchestrator instructions.

