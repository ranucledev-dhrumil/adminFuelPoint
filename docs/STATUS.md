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

**Next: awaiting orchestrator instructions.**




