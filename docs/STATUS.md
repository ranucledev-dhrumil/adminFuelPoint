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
