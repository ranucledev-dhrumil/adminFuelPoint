# FuelPoint — Backend Structure & Architecture Proposal

> **Status:** Draft Proposal for Owner Review (v2)  
> **Scope:** Backend API supporting Admin Web Panel, Worker Mobile App, and Customer Mobile App.  
> **Date:** 2026-10-12  
> **Author:** Antigravity / Engineering  
> **References:** `docs/db-schema-proposal.md` (v5, signed off), `docs/api-proposal.md`

---

## 0. Decision Log & Principles

### Decided (Owner)
- **Runtime:** Node.js v22 (Owner environment: Node v22.15.0 on Windows).
- **Package Manager:** `npm` exclusively.
- **Language & Framework:** TypeScript, Express.js.
- **Database Access:** Hand-written raw SQL migrations, native `pg` driver (`node-postgres`), and a thin repository layer. **No ORM and no query builder.**
- **API Style:** REST + JSON versioned under `/api/v1`.
- **Local Database Environment:** PostgreSQL 18 running in Docker Compose. Local host port set to `127.0.0.1:5433` (to avoid port `5432` bound to local PostgreSQL 16 on the host).
- **Worker Status & Access:** Workers with status `offline` OR `suspended` cannot log in, refresh tokens, or scan. Only workers with status `'active'` are permitted access.
- **Default Group Discount:** The admin **may** change the default group's discount percent. (The seeded default group still initializes at 0.00%.) The default group still cannot be deleted or deactivated.
- **Admin Session Delivery:** In-memory access token + `httpOnly`, `Secure`, `SameSite=Strict` refresh cookie. Hosting constraint: `SameSite=Strict` requires the admin web panel and the API to be hosted on the same site (e.g. `admin.example.com` and `api.example.com`).
- **Reports & CSV Exports:** CSV exports are generated and streamed server-side.
- **Notifications Retention:** Notifications are retained indefinitely for now (the background cleanup job does not prune notifications).
- **Email Service:** Sent via Gmail SMTP using `nodemailer` from day one. Credentials loaded strictly from environment variables (Google App Password).
- **Development Output:** In development, OTP codes and password reset links are printed to the server console log. Password reset links are also dispatched via Gmail SMTP.
- **SMS Provider:** Provider choice is deferred. Console logging adapter used during development.
- **Client Scope:** One backend serves three clients: Admin Web Panel, Worker Mobile App, and Customer Mobile App.
- **Infrastructure Constraints:** No Redis. No admin invitation workflow. Production hosting remains deliberately undecided and hosting-neutral.

### Proposed (Orchestrator)
- **Layering Architecture:** Strict unidirectional flow: `routes` -> `controllers` -> `services` -> `repositories`.
- **Domain Modules:** Dedicated `reports` module owning dashboard analytics, reporting summaries, server-side CSV streaming, and global cross-entity search.
- **Database Transactions & Audit Exception:**
  - State mutations and their corresponding `audit_logs` entries execute within the **same** database transaction.
  - **Audit Exception:** Events with no business state mutation (e.g. failed login attempts, rejected scans) must be written in an **isolated independent transaction** (or direct auto-commit statement) so that a thrown application error or transaction rollback does not erase the audit record.
- **Access Token Claims:** Strict minimal payload: `{ sub, role, aud }`.
- **Refresh Token Security:** Refresh tokens are 256-bit cryptographically secure random opaque strings stored as SHA-256 hashes in the database. No `REFRESH_TOKEN_SECRET` is needed.
- **Password Hashing:** **Argon2id** via `@node-rs/argon2`, which supplies prebuilt Windows native binaries without requiring C++ build tools (`node-gyp`).
- **Migration Tool:** `node-pg-migrate` using zero-padded 3-digit prefixes (`001_*.sql`).
- **Test Isolation:** Truncate tables between test suites against a dedicated Docker PostgreSQL test database.
- **Validation & Serialization:** `zod` for request schema validation and DTO parsing.
- **Logging:** `pino` with structured JSON output in production and `pino-pretty` in development, configured with mandatory credential/token redaction.
- **Testing:** `vitest` for unit tests and integration tests against real PostgreSQL in Docker.
- **Idempotency & Retry Safety:** Worker app supplies a client-generated UUID as `transactions.id`. If a duplicate is received, the server verifies payload identity and worker ownership; matching requests return the existing transaction (`200 OK`), while conflicts return `409 Conflict`.

---

## 1. Directory Tree & File Purpose

Below is the layout for `backend/`:

```
backend/
├── .env.example                    # Template for all environment variables (blank/obvious placeholders)
├── .gitignore                      # Git ignore file (node_modules, dist, .env, coverage)
├── Dockerfile                      # Production container image definition (multi-stage build)
├── docker-compose.yml              # Local development compose file (PostgreSQL 18 on 127.0.0.1:5433)
├── package.json                    # Project metadata, dependencies, and npm scripts
├── tsconfig.json                   # TypeScript compiler configuration (strict mode, NodeNext)
├── vitest.config.ts                # Test runner configuration
├── migrations/                     # Raw SQL migration files executed in sequence
│   ├── 001_extensions_and_types.sql
│   ├── 002_core_entities.sql
│   ├── 003_auth_and_verification.sql
│   ├── 004_activity_and_events.sql
│   └── 005_triggers_and_functions.sql
└── src/
    ├── server.ts                   # Process bootstrap, port listener, graceful shutdown handlers
    ├── app.ts                      # Express application assembly, global middleware, route registration
    ├── config/
    │   ├── env.ts                  # Zod-validated environment configuration object
    │   └── database.ts             # pg.Pool configuration and connection lifecycle
    ├── common/                     # Cross-cutting utilities, base classes, and middleware
    │   ├── errors/
    │   │   ├── app-error.ts        # Custom ApplicationError hierarchy (NotFound, Forbidden, etc.)
    │   │   └── error-handler.ts    # Global Express error handling middleware
    │   ├── middleware/
    │   │   ├── auth.ts             # JWT authentication and real-time status guard middleware
    │   │   ├── rate-limiter.ts     # General, OTP, and progressive-delay login rate limiters
    │   │   ├── validate.ts         # Zod request validation middleware
    │   │   └── request-logger.ts   # HTTP request logging using pino-http
    │   ├── utils/
    │   │   ├── phone.ts            # E.164 normalization (+91 validation and formatting)
    │   │   ├── money.ts            # High-precision decimal rounding matching Postgres ROUND
    │   │   └── crypto.ts           # Argon2id password hashing and opaque token generators
    │   └── types/
    │       ├── express.d.ts        # Express Request augmentation (req.actor)
    │       └── common.ts           # Shared interfaces (Pagination, ApiResponse, ActorClaims)
    ├── db/
    │   ├── pool.ts                 # Exported pg.Pool singleton
    │   └── transaction.ts          # withTransaction helper for atomic service execution
    ├── modules/                    # Domain feature vertical slices
    │   ├── auth/
    │   │   ├── auth.routes.ts      # Auth endpoints (/login, /otp/request, /otp/verify, /refresh, /logout)
    │   │   ├── auth.controller.ts  # Request extraction, DTO mapping, HTTP status returns
    │   │   ├── auth.service.ts     # Token issuance, revocation, and password-reset orchestration
    │   │   └── auth.repository.ts  # SQL queries for refresh_tokens and admin_password_reset_tokens
    │   ├── admin-users/
    │   │   ├── admin.routes.ts     # Admin profile & account management endpoints
    │   │   ├── admin.controller.ts # Admin profile HTTP handlers
    │   │   ├── admin.service.ts    # Admin updates, password change, deactivation logic
    │   │   └── admin.repository.ts # SQL queries for admin_users table
    │   ├── customers/
    │   │   ├── customer.routes.ts  # Customer self-registration, admin CRUD, QR retrieval & regeneration
    │   │   ├── customer.controller.ts
    │   │   ├── customer.service.ts # Customer registration, soft delete, QR regeneration, profile update
    │   │   └── customer.repository.ts # SQL queries for customers table
    │   ├── workers/
    │   │   ├── worker.routes.ts    # Worker admin management & worker profile routes
    │   │   ├── worker.controller.ts
    │   │   ├── worker.service.ts   # Worker creation, status update, first_login_at recording
    │   │   └── worker.repository.ts # SQL queries for workers table
    │   ├── groups/
    │   │   ├── group.routes.ts     # Group CRUD and member assignment routes
    │   │   ├── group.controller.ts
    │   │   ├── group.service.ts    # Group mutations, active toggling, default group discount edit
    │   │   └── group.repository.ts  # SQL queries for groups table
    │   ├── transactions/
    │   │   ├── transaction.routes.ts     # QR resolution, submit scan, resolve status
    │   │   ├── transaction.controller.ts
    │   │   ├── transaction.service.ts    # Idempotent creation, status transition, activity tracking
    │   │   └── transaction.repository.ts # SQL queries for transactions table
    │   ├── reports/
    │   │   ├── reports.routes.ts   # Dashboard analytics, reports summary, CSV export, global search
    │   │   ├── reports.controller.ts
    │   │   ├── reports.service.ts  # KPI aggregation, time series generation, CSV stream pipeline
    │   │   └── reports.repository.ts # Aggregation queries on transactions, customers, workers, groups
    │   ├── notifications/
    │   │   ├── notification.routes.ts     # Notification listing, unread count, mark read
    │   │   ├── notification.controller.ts
    │   │   ├── notification.service.ts    # Creation triggers and read state management
    │   │   └── notification.repository.ts # SQL queries for notifications table
    │   ├── audit/
    │   │   ├── audit.routes.ts     # Admin audit log filtering and inspection routes
    │   │   ├── audit.controller.ts
    │   │   ├── audit.service.ts    # Audit retrieval and standalone/in-tx log recording
    │   │   └── audit.repository.ts # Append-only INSERTs and filtered SELECTs on audit_logs
    │   └── otp/
    │       ├── otp.service.ts      # 6-digit generation, hashing, timing-safe dispatch, rate limits
    │       └── otp.repository.ts   # SQL queries for otp_codes table
    ├── integrations/               # External communication adapters
    │   ├── email/
    │   │   ├── email-sender.interface.ts # IEmailSender contract (sendPasswordReset, etc.)
    │   │   ├── nodemailer-gmail.ts       # Gmail SMTP implementation via nodemailer
    │   │   └── dev-email-logger.ts       # Development console logger fallback
    │   └── sms/
    │       ├── sms-sender.interface.ts   # ISMSSender contract (sendOtp, etc.)
    │       └── console-sms.ts            # Development console logger implementation
    ├── jobs/
    │   ├── scheduler.ts            # In-process task scheduler runner
    │   └── cleanup-expired.job.ts  # Periodic cleanup of expired OTPs, refresh tokens, reset tokens
    └── seeds/
        ├── seed.ts                 # CLI entry point to run database seeders
        ├── default-group.seed.ts   # Idempotent insertion of 0% default group
        └── first-admin.seed.ts     # Creation of initial Super Admin from environment
```

---

## 2. Domain Modules & Boundaries

The codebase is organized into bounded domain modules under `src/modules/`:

| Module | Core Responsibility | Key Dependencies | Exposed Contracts |
|---|---|---|---|
| **auth** | Login, OTP verification, access/refresh token lifecycle, token revocation, password reset flow. | `otp`, `admin-users`, `workers`, `customers`, `email`, `audit` | `verifyToken`, `revokeTokensForActor`, `issueTokens` |
| **admin-users** | Admin credentials, profile editing, password changes, deactivation (`is_active = FALSE`). | `audit`, `db` | `getAdminById`, `assertAdminActive`, `updateProfile` |
| **customers** | Customer registration (name+phone), admin CRUD, status toggle, QR token generation/regeneration, profile updates. | `groups`, `audit`, `notifications`, `db` | `getCustomerByQrToken`, `recalculateLastActivity` |
| **workers** | Attendant profiles, shift scheduling, status (`active`/`offline`/`suspended`), `first_login_at` tracking. | `audit`, `notifications`, `db` | `getWorkerById`, `recordFirstLogin`, `assertWorkerActive` |
| **groups** | Discount percentage groups, active status toggle, default group protection & discount editing. | `audit`, `db` | `getGroupById`, `getDefaultGroupId`, `resolveEffectiveDiscount` |
| **transactions** | QR resolution, transaction creation (with idempotency), status transitions, discount calculation. | `customers`, `workers`, `groups`, `audit`, `db` | `createTransaction`, `updateStatus`, `getTransactionById` |
| **reports** | Dashboard KPI overview, time-series generation, report tabular metrics, server-side CSV streaming, global search. | `transactions`, `customers`, `workers`, `groups`, `db` | `getOverviewMetrics`, `getSeriesData`, `streamCsvExport`, `globalSearch` |
| **notifications** | Admin inbox for registration and first login alerts, unread counters, mark as read. | `db` | `notifyCustomerRegistered`, `notifyWorkerFirstLogin` |
| **audit** | Immutable ledger recording all state mutations and rejected scans. Filtering API for admin. | `db` | `recordAuditEntryInTx`, `recordStandaloneAuditEntry` |
| **otp** | 6-digit generation, SHA-256 storage, attempt lockout, destination and IP rate-limiting, timing-safe dispatch. | `sms`, `email`, `db` | `requestLoginOtp`, `requestRegisterOtp`, `verifyLoginOtp`, `verifyRegisterOtp` |

---

## 3. Layering Architecture & Transaction Rules

### The Unidirectional Flow Rule
Execution strictly flows downward:
$$\text{Routes} \longrightarrow \text{Controllers} \longrightarrow \text{Services} \longrightarrow \text{Repositories} \longrightarrow \text{PostgreSQL}$$

1. **Routes (`*.routes.ts`):** Bind HTTP paths, attach Zod validation and authentication middleware, and forward to the controller. No application logic.
2. **Controllers (`*.controller.ts`):** Extract and cast inputs from `req.body`, `req.query`, `req.params`, and `req.actor`. Call service methods. Map service results into standardized HTTP JSON responses.
3. **Services (`*.service.ts`):** Host **all business logic**, orchestrate cross-module workflows, compute discounts, enforce state transitions, and demarcate database transaction boundaries.
4. **Repositories (`*.repository.ts`):** The **only** layer that executes raw SQL via the `pg` client. Repositories accept an optional transaction client parameter (`pg.PoolClient | pg.Pool`). They never contain business rules or enforce authorization.

### Database Transaction Management
Database transactions are initiated and finalized exclusively within the **Service Layer** via a helper:
```typescript
// src/db/transaction.ts
export async function withTransaction<T>(
  pool: pg.Pool,
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### The In-Transaction Audit Rule & The Standalone Audit Exception
1. **The In-Transaction Rule:**  
   Every `audit_logs` record representing a database state change (e.g. `customer.created`, `worker.status_changed`, `transaction.status_changed`) **must be written within the exact same database transaction** as the entity mutation it describes. If the business mutation fails, the audit record is rolled back; if the audit insert fails, the state mutation is rolled back.
2. **The Standalone Audit Exception (No State Mutation):**  
   Events that represent rejected actions or failures with **no business state change** (e.g. `scan.rejected`, `admin.login_failed`) must be written in an **independent, standalone database transaction** (using `pool.query` directly).  
   *Rationale:* If a scan is rejected or login fails, the service throws an error or returns a failure response. If the audit entry were tied to a rolled-back transaction, the audit row would be erased. Standalone execution ensures rejected events are reliably persisted to the audit ledger.

---

## 4. Migration Plan

### Tool Choice & File Naming
- **Tool:** `node-pg-migrate` is chosen. It runs directly via npm scripts without external binaries, works cleanly on Windows `cmd`, and tracks migrations in a `pgmigrations` table.
- **Naming Convention:** `node-pg-migrate` executes files in lexicographical order. Standard zero-padded 3-digit prefixes (`001_extensions_and_types.sql`) are fully supported and recommended:

```
migrations/
├── 001_extensions_and_types.sql     # pgcrypto extension & all custom ENUMs
├── 002_core_entities.sql            # groups, admin_users, customers, workers
├── 003_auth_and_verification.sql    # admin_password_reset_tokens, otp_codes, refresh_tokens
├── 004_activity_and_events.sql      # transactions, notifications, audit_logs
└── 005_triggers_and_functions.sql   # set_updated_at trigger & audit_logs immutability trigger
```

### Mapping Schema v5 to Migration Structure

| Migration File | Tables / Objects Created | Schema v5 References & Purpose |
|---|---|---|
| `001_extensions_and_types.sql` | `pgcrypto` extension<br>ENUMs: `customer_status`, `worker_shift`, `worker_status`, `transaction_status`, `fuel_type`, `notification_type` (`'registration'`, `'worker'`), `otp_channel`, `otp_actor_type`, `otp_purpose` | Foundation types; D28, D32, D54 |
| `002_core_entities.sql` | `groups`<br>`admin_users`<br>`customers`<br>`workers` | Primary domain entities; soft-delete flags, E.164 phone constraints, unique indexes; D03, D09, D10, D12, D15, D16, D42, D43, D44, D50, D51 |
| `003_auth_and_verification.sql` | `admin_password_reset_tokens`<br>`otp_codes`<br>`refresh_tokens` | Authentication tables; check constraint on refresh token actor, indices for token cleanup; D06, D07, D45, D47, D48, D52 |
| `004_activity_and_events.sql` | `transactions`<br>`notifications`<br>`audit_logs` | Activity tables; idempotency support, foreign key references, date-range indices; D17–D25, D35, D36, D53 |
| `005_triggers_and_functions.sql` | Function `set_updated_at()`<br>Function `prevent_audit_mutation()`<br>Triggers on mutable tables & `audit_logs` | Automatic timestamp maintenance; strict append-only immutability enforcement on `audit_logs` |

---

## 5. Configuration & Environment Variables

### `.env.example` Specification

```env
# ==============================================================================
# FuelPoint Backend Environment Configuration
# ==============================================================================

# Server Environment
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
API_PREFIX=/api/v1
CORS_ORIGIN=http://localhost:5173

# Database Connection (Docker host bound to 127.0.0.1:5433)
DB_HOST=127.0.0.1
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=fuelpoint
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_IDLE_TIMEOUT_MS=30000
DB_CONNECTION_TIMEOUT_MS=5000

# Authentication & JWT Secrets (Must be changed in production)
JWT_ACCESS_SECRET=your_jwt_access_secret_minimum_32_characters_here
JWT_ACCESS_EXPIRY=15m
ADMIN_REFRESH_TOKEN_EXPIRY_DAYS=7
USER_REFRESH_TOKEN_EXPIRY_DAYS=30
PASSWORD_RESET_TOKEN_EXPIRY_MINUTES=60

# OTP Configuration
OTP_EXPIRY_MINUTES=5
OTP_MAX_ATTEMPTS=5
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_MAX_PER_HOUR_DESTINATION=5
OTP_MAX_PER_HOUR_IP=10

# Email Integration (Gmail SMTP via Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=

# SMS Integration (Console logging in development)
SMS_PROVIDER=console
SMS_API_KEY=

# Seed Super Admin Account (Blank in .env.example; script generates random password if blank)
SEED_ADMIN_NAME=Super Admin
SEED_ADMIN_EMAIL=
SEED_ADMIN_INITIAL_PASSWORD=
```

### Production Secret Guard
At application startup (`src/config/env.ts`):
- If `NODE_ENV === 'production'`, Zod validation strictly enforces:
  - `JWT_ACCESS_SECRET` must not contain default substrings like `secret`, `dev`, or `change_me`, and must be at least 32 characters long.
  - `SMTP_USER` and `SMTP_PASSWORD` must not be empty.
  - If any condition fails, the server exits immediately with code `1`.

---

## 6. Authentication Architecture for Three Actor Types

### Actor Differentiation & Token Claims
The system authenticates three distinct actor types using standard JWT access tokens:
- `admin`
- `worker`
- `customer`

```typescript
// Access Token Payload Structure (Minimal Claims)
export interface AccessTokenClaims {
  sub: string;            // Actor UUID
  role: 'admin' | 'worker' | 'customer';
  aud: 'fuelpoint-admin' | 'fuelpoint-worker' | 'fuelpoint-customer';
  iss: 'fuelpoint-api';
  iat: number;
  exp: number;
}
```

### Refresh Token Security
Refresh tokens are **cryptographically secure 256-bit random opaque strings** generated via `crypto.randomBytes(32).toString('hex')`.  
- The client receives the raw hex token.
- The database stores only the **SHA-256 hash** (`token_hash`) in `refresh_tokens`.
- Because refresh tokens are opaque database-backed values rather than JWTs, no `REFRESH_TOKEN_SECRET` environment variable is required.

### Role Guard & Real-Time Status Validation Rule (DECIDED)
> **Security Requirement:** A valid JWT signature alone is **insufficient** for authorization. Every authenticated request must execute a fast status verification against the database:
- **Admin:** Query `admin_users` to confirm `is_active === TRUE`. If deactivated, respond with `401 Unauthorized` / `403 Forbidden`.
- **Worker (DECIDED):** Query `workers` to confirm `deleted_at IS NULL` and **`status === 'active'`**. Workers with status `'offline'` or `'suspended'` cannot log in, refresh tokens, or execute scans/transactions. If `offline` or `suspended`, respond with `403 Forbidden` (`WORKER_NOT_ACTIVE` or `WORKER_SUSPENDED`).
- **Customer:** Query `customers` to confirm `deleted_at IS NULL` and `status === 'active'`. If inactive or soft-deleted, respond with `403 Forbidden` (`CUSTOMER_INACTIVE`).

### Token Revocation Hooks
Whenever an administrative status mutation occurs:
- Admin sets `admin_users.is_active = FALSE` $\rightarrow$ Revoke all active tokens:  
  `UPDATE refresh_tokens SET revoked_at = now() WHERE admin_user_id = $1 AND revoked_at IS NULL`
- Admin changes worker status to `offline` or `suspended`, or soft-deletes worker $\rightarrow$ Revoke all active tokens:  
  `UPDATE refresh_tokens SET revoked_at = now() WHERE worker_id = $1 AND revoked_at IS NULL`
- Admin soft-deletes customer $\rightarrow$ Revoke all active tokens:  
  `UPDATE refresh_tokens SET revoked_at = now() WHERE customer_id = $1 AND revoked_at IS NULL`

---

## 7. Password Hashing: Selection & Justification

### Selected Library: Argon2id via `@node-rs/argon2`
- **Algorithm:** Argon2id (Winner of the Password Hashing Competition; OWASP #1 primary recommendation).
- **Justification over `bcrypt` and native `argon2`:**
  1. **Prebuilt Windows Binaries:** `@node-rs/argon2` uses Rust N-API bindings that distribute precompiled binaries for Windows (`@node-rs/argon2-win32-x64-msvc`). It requires **zero** native compiler toolchains (`node-gyp`, Python, Visual C++ Build Tools), ensuring effortless installation on the owner's Windows machine.
  2. **Security & Resistance:** Argon2id provides superior resistance to GPU/ASIC cracking and side-channel timing attacks compared to legacy bcrypt.
  3. **Performance:** Native Rust implementation runs efficiently with memory-hard parameters suitable for backend authentication.

---

## 8. Currency, Numeric Precision & Rounding

### PostgreSQL Driver Return Behavior
The `pg` driver intentionally parses PostgreSQL `NUMERIC` and `DECIMAL` types into JavaScript **`string`** values (e.g. `"1250.50"`). This prevents silent precision loss inherent in JavaScript IEEE 754 floating-point representation.

### Discount Computation & Precision Standards
1. **Rule:** Discount rounding must match PostgreSQL's `ROUND(amount * discount_percent / 100, 2)`:
   - Evaluated to 2 decimal places.
   - Half-up rounding logic.
2. **Implementation Strategy:**
   - Use the `decimal.js` library for all in-memory calculations in the service layer:
     ```typescript
     import { Decimal } from 'decimal.js';

     export function calculateDiscount(amount: string, discountPercent: string): {
       discountAmount: string;
       finalAmount: string;
     } {
       Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
       const amt = new Decimal(amount);
       const pct = new Decimal(discountPercent);
       const disc = amt.mul(pct).div(100).toDecimalPlaces(2);
       const final = amt.sub(disc);

       return {
         discountAmount: disc.toFixed(2),
         finalAmount: final.toFixed(2)
       };
     }
     ```
   - In SQL inserts and updates, values are passed as strings (`$1::numeric`) and validated by the database constraint:
     `CHECK (discount_amount <= amount AND discount_amount >= 0)`

---

## 9. Cross-Cutting Concerns

### Standardized Error Format
All API errors return a uniform JSON envelope:
```json
{
  "error": {
    "code": "WORKER_NOT_ACTIVE",
    "message": "Worker is currently offline or suspended.",
    "details": null
  }
}
```

### Progressive Delay & IP Limiting on Admin Login
To prevent brute-force attacks without enabling denial-of-service on the single admin:
- **No Hard Lockout:** Do not lock out the admin account based solely on email (an attacker could deliberately lock out the admin).
- **Progressive Delay:** After 3 consecutive failed attempts on an email, the backend adds an artificial delay ($1\text{s}, 2\text{s}, 4\text{s}$) to response completion.
- **Per-IP Rate Limiting:** Enforce a strict IP-based limit of max 10 failed login attempts per 15 minutes per IP address.

### Request Logging & Sensitive Data Redaction
Using `pino` and `pino-http`, structured logs are emitted. Sensitive credential fields are redacted at the serializer level:
```typescript
const logger = pino({
  redact: {
    paths: [
      'req.headers.authorization',
      'req.body.password',
      'req.body.code',
      '*.password_hash',
      '*.token_hash',
      '*.code_hash',
      '*.qr_token'
    ],
    censor: '[REDACTED]'
  }
});
```

### Health Endpoint & Graceful Shutdown
- **Endpoint:** `GET /api/v1/health` verifies application status and executes `SELECT 1` on the PostgreSQL connection pool.
- **Graceful Shutdown:** Process traps `SIGTERM` and `SIGINT`:
  1. Stops accepting incoming HTTP connections (`server.close()`).
  2. Waits for ongoing in-flight requests to complete (with a 10-second timeout).
  3. Drains and closes the `pg.Pool`.
  4. Exits with code `0`.

---

## 10. Background Cleanup Strategy

The database accumulates transient rows:
- `otp_codes`: Expired (> 5 min) or consumed.
- `refresh_tokens`: Revoked or expired (> 7/30 days).
- `admin_password_reset_tokens`: Used or expired (> 60 min).
- *(Notifications are explicitly retained indefinitely per owner decision).*

### Implementation
- **In-process scheduler (`node-cron`)** initialized in `src/jobs/scheduler.ts` running once every hour during development.
- The same task is also exposed as an independent script (`npm run job:cleanup`) so production can seamlessly run it via an external cron or container worker without code modification.

---

## 11. Database Seeding Strategy

Seeding runs via `npm run seed`:

### 1. Default Group Seeding
Ensures the mandatory fallback group exists idempotently:
```sql
INSERT INTO groups (id, name, discount_percent, description, active, is_default)
VALUES ('00000000-0000-0000-0000-000000000001', 'Standard (Default)', 0.00, 'Default group for newly registered customers', TRUE, TRUE)
ON CONFLICT (is_default) WHERE is_default = TRUE AND deleted_at IS NULL
DO NOTHING;
```

### 2. First Admin Account Seeding
1. Checks if any admin exists in `admin_users`. If an admin row exists, skips execution.
2. Reads `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME`, and `SEED_ADMIN_INITIAL_PASSWORD` from `.env`.
3. If `SEED_ADMIN_INITIAL_PASSWORD` is omitted, the script generates a secure 16-character random password using `crypto.randomBytes()`.
4. Hashes the password using Argon2id.
5. Inserts the Super Admin row.
6. Prints the initial login email and plain password to the console with a reminder to update it upon first login.

---

## 12. Testing Strategy

### Framework: Vitest
- **Vitest** is recommended over Jest due to native TypeScript support via esbuild, ultra-fast execution, zero-config module resolution, and seamless integration with modern Node.js.

### Database Test Isolation (Truncation Strategy)
Because backend services open their own internal transactions (`withTransaction`), wrapping entire tests in rolling-back outer transactions does not isolate nested commits.  
- **Strategy:** Between test suites, execute a fast table truncation helper against the dedicated test database (`fuelpoint_test`):
  ```sql
  TRUNCATE TABLE transactions, refresh_tokens, otp_codes, admin_password_reset_tokens,
                 notifications, audit_logs, customers, workers, groups, admin_users
  RESTART IDENTITY CASCADE;
  ```
- Seed scripts re-run minimal required records (default group and test admin) prior to test suite execution.

---

## 13. Local Docker Compose Architecture & README Outline

### Docker Compose Configuration (`docker-compose.yml`)
```yaml
services:
  postgres:
    image: postgres:18-alpine
    container_name: fuelpoint-postgres
    restart: unless-stopped
    ports:
      - "127.0.0.1:5433:5432"  # Bound strictly to localhost on host port 5433
    environment:
      POSTGRES_DB: fuelpoint
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql  # PG 18 mounts volume at /var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d fuelpoint"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
    driver: local
```

### Proposed `backend/README.md` Outline
1. **Overview & Scope:** Three-client backend architecture (Admin, Worker, Customer).
2. **Prerequisites:** Node.js v22.15.0+, Docker Desktop.
3. **Quick Start Guide:**
   - `docker compose up -d`
   - `npm install`
   - `cp .env.example .env` (configure credentials)
   - `npm run migrate`
   - `npm run seed`
   - `npm run dev`
4. **Environment Variables Reference:** Complete table of `.env` options.
5. **API Documentation:** Summary of route endpoints and authentication requirements.
6. **Testing:** How to execute unit and integration test suites.
7. **Windows Development Notes:** Port mapping and shell execution guidance.

---

## 14. Windows Development Notes

The project owner develops on Windows using `cmd`:
1. **Port Avoidance (Port 5433 on 127.0.0.1):** The host Windows machine already runs PostgreSQL 16 on port 5432. Docker Compose binds container port 5432 to host loopback port **`127.0.0.1:5433`**.
2. **Cross-Platform NPM Scripts:** Use `cross-env` in `package.json` scripts where environment variables are injected (e.g., `cross-env NODE_ENV=test vitest`).
3. **Line Endings (CRLF vs LF):** Git repository configured with `.gitattributes` to ensure `.sql` migration files and `.env` files retain standard LF endings to avoid parser anomalies.
4. **Shell Execution:** All npm scripts use standard commands that execute equivalently in Windows `cmd.exe`, PowerShell, and bash.

---

## 15. Open Questions

1. **Production Hosting Infrastructure:** Production hosting is deliberately undecided. Will the production deployment use a single container VPS (e.g. DigitalOcean Droplet, Hetzner), a managed container platform (e.g. Render, AWS App Runner), or serverless containers?
2. **SMS Gateway Provider Selection:** When mobile apps enter pilot testing, which Indian SMS gateway will be selected (e.g., MSG91, Fast2SMS, Twilio)? Note that commercial Indian SMS requires TRAI DLT registration and template approval.

---

*End of backend structure proposal. Awaiting orchestrator instructions.*
