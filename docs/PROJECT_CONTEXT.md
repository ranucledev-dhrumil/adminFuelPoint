# FuelPoint — Project Context & Handoff Guide

> **Status:** Project Finalised (Tasks 0–21 Complete)  
> **Last Updated:** 2026-10-13  
> **Environment:** Windows (cmd), Node.js v22 (v22.15.0), npm, Docker Desktop  
> **Primary Sources of Truth:**  
> - `docs/db-schema-proposal.md` (Database Schema v5, signed off)  
> - `docs/backend-structure-proposal.md` (Backend Architecture v2)  
> - `docs/api-proposal.md` (REST API Specification v2)  

---

## 1. Purpose & Scope

**FuelPoint** is a petrol pump operations and customer loyalty management system designed for a **single fuel station** (no multi-station architecture).

One central backend serves three clients sharing a single PostgreSQL database:
1. **Admin Web Panel (`frontend/`):** React 19 SPA used by the station owner/manager for customer and attendant management, discount groups, reports/analytics, transaction status overrides, and an audit ledger. Fully wired to the real backend API.
2. **Worker Mobile App (Backend API fully implemented & verified; UI out of scope):** Pump attendant POS app used to scan customer QR tokens, prefill fuelling forms, submit transactions, and mark payments as `success` or `failed`.
3. **Customer Mobile App (Backend API fully implemented & verified; UI out of scope):** Customer loyalty app for self-registration, OTP login, QR code loyalty token display, QR regeneration, transaction history, and profile management.

---

## 2. Repository Layout

```
adminFuelPoint/
├── frontend/     # React 19 SPA (TanStack Router, Vite 8, Tailwind CSS v4, Radix UI) - Real API Wired
├── backend/      # Node.js v22 + Express + TypeScript API (10 tables, full REST API, 100% tests passing)
│   ├── postman/  # Comprehensive Postman Collection & Local Environment
│   └── src/tests/# 12 Vitest test suites (224 tests passing, including full E2E flow)
└── docs/         # Architectural specifications, decision logs, and task status logs
    ├── PROJECT_CONTEXT.md               # This handoff guide
    ├── STATUS.md                        # Incremental task-by-task execution log
    ├── db-schema-proposal.md            # PostgreSQL 18 schema v5 (10 tables, triggers, constraints)
    ├── backend-structure-proposal.md    # Layered architecture, Docker Compose, migrations, auth design
    └── api-proposal.md                  # Complete REST API specification (/api/v1) for all 3 clients
```

---

## 3. Technology Stack & Core Decisions

Detailed rationales are recorded in the respective documents:

- **Database (`docs/db-schema-proposal.md` - Decision Log D01–D54):**
  - PostgreSQL 18 with `UUID` primary keys (`gen_random_uuid()`).
  - 10 tables: `admin_users`, `admin_password_reset_tokens`, `groups`, `customers`, `workers`, `otp_codes`, `refresh_tokens`, `transactions`, `notifications`, `audit_logs`.
  - All phone numbers stored in E.164 (`+91`); bare 10-digit inputs automatically normalized.
  - Money and fuel volumes stored as `NUMERIC(12,2)` / `NUMERIC(8,2)`; discount rounding evaluated as `ROUND(amount * discount_percent / 100, 2)`.
  - Soft delete on customers, workers, and groups (`deleted_at`); immutable transactions and audit logs.
  - Transaction lifecycle: `pending` $\rightarrow$ `success` or `failed`; `success` $\leftrightarrow$ `failed` allowed; reverting to `pending` is strictly forbidden.
  - Customer `last_activity_at` atomically recalculated on transaction status changes to/from `success`.
  - Attendant `last_activity_at` records latest submission of any status (unaffected by status changes).
- **Backend Architecture (`docs/backend-structure-proposal.md`):**
  - Node.js v22, Express.js, TypeScript, npm only.
  - Pure raw SQL migrations using `node-pg-migrate` (zero external binaries); native `pg` driver with thin repositories. **No ORM and no query builder.**
  - Docker Compose running PostgreSQL 18 mapped to loopback `127.0.0.1:5433:5432` (avoids host PG 16 on `5432`).
  - Strict layering: `routes` $\rightarrow$ `controllers` $\rightarrow$ `services` $\rightarrow$ `repositories`.
  - Dedicated `reports` module owning analytics, KPI metrics, server-side CSV streaming, and global search.
  - Password hashing via **Argon2id** (`@node-rs/argon2`, prebuilt Windows native binaries).
  - Transactions & Audit: Business mutations and audit logs commit in the **same transaction**. Failed events with no state change (`scan.rejected`, `admin.login_failed`) commit in an **independent standalone transaction**.
  - Email via Gmail SMTP (`nodemailer`) with Google App Password; dev fallback prints clickable reset links to terminal.
  - Test isolation: Table truncation between test suites against a dedicated Docker test database (`fuelpoint_test`).
- **REST API (`docs/api-proposal.md`):**
  - Versioned REST + JSON under `/api/v1`.
  - Currency amounts and volumes returned as 2-decimal strings to prevent precision loss.
  - Day boundaries bounded by `Asia/Kolkata` (IST, UTC+5:30) for analytics and "today" counters.
  - Session delivery: Admin web panel uses in-memory access token + `httpOnly`, `Secure`, `SameSite=Strict` cookie; mobile apps use Bearer headers + secure OS Keychain storage.
  - Worker status guard: Only workers with status `'active'` may log in, refresh tokens, or scan. Status `offline` or `suspended` is blocked with HTTP 403.
  - Signed Scan Tickets: `POST /worker/scan` verifies QR ($\ge 128$ bits entropy) and issues a short-lived (5m) HMAC-SHA256 signed ticket used to submit transactions.
  - Submission idempotency: Worker supplies client UUID; duplicate IDs verify matching payload and worker (`200 OK` on match; `409 Conflict` on mismatch).
  - Single OTP consumption: `/auth/otp/verify` is login-only; `POST /customer/register` verifies and consumes registration OTP directly.
  - Default group discount may be updated by admin (initializes at 0.00%); default group cannot be deleted or deactivated.

---

## 4. How to Run the Project

### 4.1 Backend
```cmd
cd backend
docker compose up -d
npm install
copy .env.example .env
npm run migrate
npm run seed
npm run dev
```
- Runs on `http://localhost:5000/api/v1`.
- Connects to local Docker PostgreSQL on `127.0.0.1:5433`.
- Automated test suite: `npm test` (executes 12 test suites, 224 tests against `fuelpoint_test`).
- End-to-end test flow: `npx vitest run src/tests/e2e.test.ts`.

### 4.2 Frontend
```cmd
cd frontend
npm install
copy .env.example .env
npm run dev
```
- Runs on `http://localhost:5173`.
- Fully wired to `http://localhost:5000/api/v1` via TanStack Query and in-memory access token + refresh cookie.
- Quality gates: `npm run typecheck`, `npm run lint`.

---

## 5. Working Agreement & Project Governance

1. **Roles:**
   - **Owner:** Defines requirements, resolves business questions, approves proposals, and signs off deliverables.
   - **Claude (Orchestrator):** Analyzes project trajectory, formulates task specifications, reviews progress, and ensures alignment.
   - **Antigravity (Coding Assistant):** Executes task instructions, runs validation checks, and produces code/documentation strictly within the assigned task boundaries.
2. **Sources of Truth:**
   - The three specification documents (`docs/db-schema-proposal.md`, `docs/backend-structure-proposal.md`, and `docs/api-proposal.md`) govern all implementation.
3. **Execution Rules:**
   - Windows cmd-friendly npm scripts only.
   - Never commit secrets, credentials, or `.env`.
   - Never run `git commit` directly; suggest a one-line commit message at the end of each task.
   - Quality gate commands (`typecheck`, `lint`, `test`) must be run and reported with real outputs.

---

## 6. Deferred Decisions & Operational Constraints

1. **Commercial SMS Provider (India DLT):**
   - In development: OTP codes are printed to the server console log via `DevSmsSender`; no SMS gateway is required.
   - In production: Commercial SMS delivery in India requires mandatory TRAI Distributed Ledger Technology (DLT) entity and template registration. Provider selection (e.g. MSG91, Fast2SMS, Twilio) is deferred until mobile app pilot testing.
2. **Production Hosting & Cookie Same-Site Constraint:**
   - Production hosting is deliberately undecided (single VPS, Render, AWS App Runner, etc.).
   - **Hosting Constraint:** The admin panel refresh session uses `SameSite=Strict` cookies. This requires the admin panel and the backend API to be deployed on the **same site** (e.g. `admin.fuelpoint.com` and `api.fuelpoint.com`).

---

## 7. Complete Task History & Status (from `docs/STATUS.md`)

| Task | Date | Focus | Output / Status |
|---|---|---|---|
| **Task 0** | 2026-10-09 | Baseline check & repository health | Restored deleted files, ran dev/build checks. ✅ Done |
| **Task 1** | 2026-10-12 | Restructure + SPA migration | Migrated from TanStack Start/Nitro to pure Vite SPA in `frontend/`. ✅ Done |
| **Task 2** | 2026-10-12 | Database schema proposal v1 | Page inventory and 7-table initial data model. ✅ Done |
| **Task 3** | 2026-10-12 | Database schema proposal v2 | Incorporated initial owner decisions (10 tables, OTP auth). ✅ Done |
| **Task 4** | 2026-10-12 | Database schema proposal v3 | Added decisions D34–D49 (E.164, IST timezone, OTP fixes). ✅ Done |
| **Task 5** | 2026-10-12 | Database schema proposal v4 | Added D50–D52 (Indian phone rules, first login tracking). ✅ Done |
| **Task 6** | 2026-10-12 | Database schema proposal v5 (Final) | `last_activity_at` recalculation, idempotency, signed off by owner. ✅ Signed Off |
| **Task 7** | 2026-10-12 | Backend structure proposal v1 | Layered architecture, Docker Compose, Gmail SMTP, migrations. ✅ Done |
| **Task 8** | 2026-10-12 | REST API proposal v1 | Complete `/api/v1` specification across 3 clients. ✅ Done |
| **Task 9** | 2026-10-12 | Patch API & Backend proposals (v2) | Applied owner decisions (offline workers, default group edit, signed tickets, reports module). ✅ Done |
| **Task 10** | 2026-10-12 | Project context handoff document | Created `docs/PROJECT_CONTEXT.md` summarizing context, stack, and rules. ✅ Done |
| **Task 11** | 2026-10-12 | Backend scaffolding & health check | Express + TypeScript, Docker PostgreSQL 18 container, health endpoint. ✅ Done |
| **Task 12** | 2026-10-12 | Database migrations & triggers | 10 tables, 14 constraints, 20 indexes, 2 PL/pgSQL triggers, default group seed. ✅ Done |
| **Task 13** | 2026-10-12 | Admin Auth & Password management | Argon2id, JWT + httpOnly cookie, Gmail SMTP reset, all-devices logout. ✅ Done |
| **Task 14** | 2026-10-12 | Admin Groups Management | Group CRUD, default group protection, atomic member reassignment. ✅ Done |
| **Task 15** | 2026-10-12 | Workers & Customers Management | Worker/Customer CRUD, status guards, phone normalization, QR generation. ✅ Done |
| **Task 16** | 2026-10-13 | OTP, Customer & Worker mobile flows | Timing-safe OTP, signed scan tickets, idempotent transactions, status guards. ✅ Done |
| **Task 17** | 2026-10-13 | Admin Profile Management | Profile GET/PATCH, password verification, Argon2id re-hashing, audit logging. ✅ Done |
| **Task 18** | 2026-10-13 | Analytics, Reports, Search & Cleanup | IST day boundaries, KPI cards, CSV streaming, global search, background cleanup. ✅ Done |
| **Task 19** | 2026-10-13 | Vitest Integration Test Suites | 11 test files, 211 tests covering all endpoints, triggers, constraints, and jobs. ✅ Done |
| **Task 20** | 2026-10-13 | Frontend Wiring (Phases A, B, C) | Full SPA wired to real REST API: auth, groups, customers, workers, dashboard, reports. ✅ Done |
| **Task 21** | 2026-10-13 | E2E Tests, Postman & Finalisation | Automated E2E test (13 steps), Postman collection & environment, README, handoff guide. ✅ Complete |
