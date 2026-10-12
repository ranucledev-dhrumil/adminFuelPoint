# FuelPoint — Backend Structure & Architecture Proposal

> **Status:** Draft for review — architecture and structure proposal.  
> **Scope:** Backend API supporting Admin Web Panel, Worker Mobile App, and Customer Mobile App.  
> **Date:** 2026-10-12  
> **Author:** Antigravity / Engineering  
> **Reference:** `docs/db-schema-proposal.md` (v5, signed off)

---

## 0. Decision Log & Principles

### Decided (Owner)
- **Runtime:** Node.js v22 (Owner environment: Node v22.15.0 on Windows).
- **Package Manager:** `npm` exclusively.
- **Language & Framework:** TypeScript, Express.js.
- **Database Access:** Hand-written raw SQL migrations, native `pg` driver (`node-postgres`), and a lightweight repository layer. **No ORM and no query builder.**
- **API Style:** REST + JSON versioned under `/api/v1`.
- **Local Database Environment:** PostgreSQL 18 running in Docker Compose. Local host port set to `5433` (as port `5432` is already bound to local PostgreSQL 16 on the host).
- **Email Service:** Sent via Gmail SMTP using `nodemailer` from day one. Credentials loaded strictly from environment variables (Google App Password).
- **Development Output:** In development, OTP codes and password reset links are printed to the server console log. Password reset links are also dispatched via Gmail SMTP.
- **SMS Provider:** Provider choice is deferred. Console logging adapter used during development.
- **Client Scope:** One backend serves three clients: the Admin Web Panel, the Worker Mobile App, and the Customer Mobile App.

### Proposed (Orchestrator)
- **Layering Architecture:** Strict unidirectional flow: `routes` -> `controllers` -> `services` -> `repositories`.
- **Database Transactions:** Managed explicitly in the service layer; `audit_logs` entries are written within the **same** database transaction as the state mutation.
- **Migration Tool:** `node-pg-migrate` for native TypeScript/npm script integration with raw SQL files.
- **Validation & Serialization:** `zod` for request schema validation and DTO parsing.
- **Logging:** `pino` with structured JSON output in production and `pino-pretty` in development, configured with mandatory credential/token redaction.
- **Testing:** `vitest` for unit tests and integration tests against real PostgreSQL in Docker.
- **Idempotency & Retry Safety:** Worker app supplies client-generated UUID as `transactions.id` (Option A from Schema v5).
- **Production Hosting:** Deliberately uncommitted; proposal remains strictly cloud- and host-agnostic.

---

## 1. Directory Tree & File Purpose

Below is the proposed layout for `backend/`:

```
backend/
├── .env.example                    # Template for all environment variables with dev defaults
├── .gitignore                      # Git ignore file (node_modules, dist, .env, coverage)
├── Dockerfile                      # Production container image definition (multi-stage build)
├── docker-compose.yml              # Local development compose file (PostgreSQL 18 on port 5433)
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
    │   └── database.ts             # pg.Pool configuration and lifecycle management
    ├── common/                     # Cross-cutting utilities, base classes, and middleware
    │   ├── errors/
    │   │   ├── app-error.ts        # Custom ApplicationError hierarchy (NotFound, Forbidden, etc.)
    │   │   └── error-handler.ts    # Global Express error handling middleware
    │   ├── middleware/
    │   │   ├── auth.ts             # JWT authentication and role-guard middleware
    │   │   ├── rate-limiter.ts     # General and route-specific rate limiting (IP-based)
    │   │   ├── validate.ts         # Zod request validation middleware
    │   │   └── request-logger.ts   # HTTP request logging using pino-http
    │   ├── utils/
    │   │   ├── phone.ts            # E.164 normalization (+91 validation and formatting)
    │   │   ├── money.ts            # High-precision decimal rounding matching Postgres ROUND
    │   │   └── crypto.ts           # Argon2id/bcrypt hashing and random token generators
    │   └── types/
    │       ├── express.d.ts        # Express Request augmentation (actor context: req.actor)
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
    │   │   ├── customer.routes.ts  # Customer self-registration, admin CRUD, QR retrieval
    │   │   ├── customer.controller.ts
    │   │   ├── customer.service.ts # Customer registration, soft delete, QR regeneration
    │   │   └── customer.repository.ts # SQL queries for customers table
    │   ├── workers/
    │   │   ├── worker.routes.ts    # Worker admin management & worker profile routes
    │   │   ├── worker.controller.ts
    │   │   ├── worker.service.ts   # Worker creation, status update, first_login_at recording
    │   │   └── worker.repository.ts # SQL queries for workers table
    │   ├── groups/
    │   │   ├── group.routes.ts     # Group CRUD and member assignment routes
    │   │   ├── group.controller.ts
    │   │   ├── group.service.ts    # Group mutations, active toggling, default group guard
    │   │   └── group.repository.ts  # SQL queries for groups table
    │   ├── transactions/
    │   │   ├── transaction.routes.ts     # QR resolution, submit scan, resolve status
    │   │   ├── transaction.controller.ts
    │   │   ├── transaction.service.ts    # Idempotent creation, status transition, activity tracking
    │   │   └── transaction.repository.ts # SQL queries for transactions table
    │   ├── notifications/
    │   │   ├── notification.routes.ts     # Notification listing, unread count, mark read
    │   │   ├── notification.controller.ts
    │   │   ├── notification.service.ts    # Creation triggers and read state management
    │   │   └── notification.repository.ts # SQL queries for notifications table
    │   ├── audit/
    │   │   ├── audit.routes.ts     # Admin audit log filtering and inspection routes
    │   │   ├── audit.controller.ts
    │   │   ├── audit.service.ts    # Audit retrieval and structured log recording
    │   │   └── audit.repository.ts # Append-only INSERTs and filtered SELECTs on audit_logs
    │   └── otp/
    │       ├── otp.service.ts      # 6-digit generation, hashing, timing-safe dispatch, rate limits
    │       └── otp.repository.ts   # SQL queries for otp_codes table
    ├── integrations/               # External communication adapters
    │   ├── email/
    │   │   ├── email-sender.interface.ts # IEmailSender contract (sendPasswordReset, etc.)
    │   │   ├── nodemailer-gmail.ts       # Gmail SMTP implementation via nodemailer
    │   │   └── dev-email-logger.ts       # Fallback / development console logger
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
| **customers** | Customer registration (name+phone), admin CRUD, status toggle, QR token generation/regeneration. | `groups`, `audit`, `notifications`, `db` | `getCustomerByQrToken`, `recalculateLastActivity` |
| **workers** | Attendant profiles, shift scheduling, status (active/offline/suspended), `first_login_at` tracking. | `audit`, `notifications`, `db` | `getWorkerById`, `recordFirstLogin`, `assertWorkerActive` |
| **groups** | Discount percentage groups, active status toggle, default group protection. | `audit`, `db` | `getGroupById`, `getDefaultGroupId`, `resolveEffectiveDiscount` |
| **transactions** | QR resolution, transaction creation (with idempotency), status transitions, discount calculation. | `customers`, `workers`, `groups`, `audit`, `db` | `createTransaction`, `updateStatus`, `getAnalytics` |
| **notifications** | Admin inbox for registration and first login alerts, unread counters, mark as read. | `db` | `notifyCustomerRegistered`, `notifyWorkerFirstLogin` |
| **audit** | Immutable ledger recording all state mutations and rejected scans. Filtering API for admin. | `db` | `recordAuditEntry` (must execute in caller's transaction) |
| **otp** | 6-digit generation, SHA-256 storage, attempt lockout, destination and IP rate-limiting, timing-safe dispatch. | `sms`, `email`, `db` | `requestLoginOtp`, `requestRegisterOtp`, `verifyOtp` |

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
Database transactions are initiated and finalized exclusively within the **Service Layer**.

We implement a reusable transaction utility:
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

### Critical Audit Log Rule
> **Rule:** Every `audit_logs` record representing a database state change **must be written within the exact same database transaction** as the entity mutation it describes.

If a customer update succeeds but the audit insertion fails, the entire transaction must roll back. Conversely, if the business operation fails, no orphaned audit row is preserved.

```typescript
// Example inside TransactionService:
await withTransaction(this.pool, async (client) => {
  // 1. Mutate state
  const updatedTx = await this.txRepo.updateStatus(client, txId, newStatus, reason);

  // 2. Recalculate customer last activity if moving to/from success
  if (affectsCustomerActivity) {
    await this.customerRepo.recalculateLastActivity(client, updatedTx.customer_id);
  }

  // 3. Write audit log in the SAME transaction
  await this.auditRepo.insertLog(client, {
    actor_type: actor.role,
    actor_id: actor.id,
    actor_name: actor.name,
    action: 'transaction.status_changed',
    entity_type: 'transaction',
    entity_id: txId,
    old_status: oldStatus,
    new_status: newStatus,
    reason: reason ?? null,
    new_value: { failure_reason: reason },
    ip_address: reqIp,
    user_agent: userAgent,
  });

  return updatedTx;
});
```

---

## 4. Migration Plan

### Tool Comparison & Recommendation
- **`dbmate`:** Standalone Go binary, language-agnostic, very fast. However, it requires a separate platform binary installation or Docker execution, adding toolchain friction on Windows development machines.
- **`node-pg-migrate` (Recommended):** TypeScript/JavaScript native library running directly via `npm run migrate`. Supports pure raw `.sql` migration files, stores migration state cleanly in a `pgmigrations` table, and integrates seamlessly into Node.js CI/CD and local development scripts without extra system binaries.

### Naming & Ordering Strategy
Migration files are placed in `backend/migrations/` using 3-digit sequential numbering:
`migrations/001_initial_schema.sql`

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

# Database Connection (Docker host port 5433 to avoid conflict with local PG 16 on 5432)
DB_HOST=localhost
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=fuelpoint
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_IDLE_TIMEOUT_MS=30000
DB_CONNECTION_TIMEOUT_MS=5000

# Authentication & JWT Secrets
JWT_ACCESS_SECRET=dev_jwt_access_secret_change_me_in_production_min_32_chars
JWT_ACCESS_EXPIRY=15m
REFRESH_TOKEN_SECRET=dev_refresh_secret_change_me_in_production_min_32_chars
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
SMTP_USER=fuelpoint.station.notifications@gmail.com
SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx
EMAIL_FROM="FuelPoint Admin" <fuelpoint.station.notifications@gmail.com>

# SMS Integration (Console logging in development)
SMS_PROVIDER=console
SMS_API_KEY=

# Seed Super Admin Account
SEED_ADMIN_NAME="Station Admin"
SEED_ADMIN_EMAIL=admin@fuelpoint.com
SEED_ADMIN_INITIAL_PASSWORD=Admin@FuelPoint2026!
```

### Runtime Validation via Zod
At startup (`src/config/env.ts`), `process.env` is validated using a strict Zod schema. If any mandatory variable is missing or improperly formatted, the process logs an informative error and exits immediately with code `1` (fail-fast principle).

---

## 6. Authentication Architecture for Three Actor Types

### Actor Differentiation & Token Claims
The system authenticates three distinct actor types using standard JWT access tokens:
- `admin`
- `worker`
- `customer`

```typescript
// Access Token Payload Structure
export interface AccessTokenClaims {
  sub: string;            // Actor UUID
  role: 'admin' | 'worker' | 'customer';
  aud: 'fuelpoint-admin' | 'fuelpoint-worker' | 'fuelpoint-customer';
  iss: 'fuelpoint-api';
  name: string;
  phone?: string;
  email?: string;
  iat: number;
  exp: number;
}
```

### Role Guard Middleware Hierarchy
1. `authenticateToken`: Validates JWT signature, checks expiration, and extracts `req.actor`.
2. Role Checkers:
   - `requireAdmin`: Asserts `req.actor.role === 'admin'`.
   - `requireWorker`: Asserts `req.actor.role === 'worker'`.
   - `requireCustomer`: Asserts `req.actor.role === 'customer'`.

### Per-Request Actor Status Validation Rule
> **Security Requirement:** A valid JWT signature alone is **insufficient** for authorization. Every authenticated request must execute a fast status verification against the database:
- **Admin:** Query `admin_users` to confirm `is_active === TRUE`. If deactivated, respond with `401 Unauthorized` / `403 Forbidden`.
- **Worker:** Query `workers` to confirm `deleted_at IS NULL` and `status !== 'suspended'`. If suspended or soft-deleted, respond with `403 Forbidden` (`WORKER_SUSPENDED`).
- **Customer:** Query `customers` to confirm `deleted_at IS NULL` and `status === 'active'`. If inactive or soft-deleted, respond with `403 Forbidden` (`CUSTOMER_INACTIVE`).

### Token Revocation Hooks
Whenever an administrative state change occurs:
- Admin sets `admin_users.is_active = FALSE` $\rightarrow$ Immediate SQL revocation:
  `UPDATE refresh_tokens SET revoked_at = now() WHERE admin_user_id = $1 AND revoked_at IS NULL`
- Admin suspends or soft-deletes a worker $\rightarrow$ Immediate SQL revocation:
  `UPDATE refresh_tokens SET revoked_at = now() WHERE worker_id = $1 AND revoked_at IS NULL`
- Admin soft-deletes a customer $\rightarrow$ Immediate SQL revocation:
  `UPDATE refresh_tokens SET revoked_at = now() WHERE customer_id = $1 AND revoked_at IS NULL`

---

## 7. Currency, Numeric Precision & Rounding

### PostgreSQL Driver Return Behavior
The `pg` driver intentionally parses PostgreSQL `NUMERIC` and `DECIMAL` types into JavaScript **`string`** values (e.g., `"1250.50"`). This prevents silent precision loss inherent in JavaScript IEEE 754 floating-point representation.

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

## 8. Cross-Cutting Concerns

### Standardized Error Format
All API errors return a uniform JSON envelope:
```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "The phone number or OTP code entered is incorrect.",
    "details": null
  }
}
```
Validation errors (`ZodError`) return an array of invalid fields:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input validation failed.",
    "details": [
      { "field": "phone", "issue": "Must be a valid 10-digit Indian phone number" }
    ]
  }
}
```

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

### Security Headers & Rate Limiting
- **Headers:** `helmet()` with default security headers (HSTS, Content-Security-Policy, X-Frame-Options).
- **CORS:** Restrict origins to configured `CORS_ORIGIN` (Admin Vite dev server on `http://localhost:5173`).
- **Rate Limiting:**
  - Global API: 100 requests per minute per IP.
  - Registration OTP endpoint: 10 requests per hour per IP (`idx_otp_request_ip_created`).
  - Destination OTP endpoint: 5 requests per hour per destination (`idx_otp_destination_created`).

### Health Endpoint & Graceful Shutdown
- **Endpoint:** `GET /api/v1/health` verifies application status and executes `SELECT 1` on the PostgreSQL connection pool.
- **Graceful Shutdown:** Process traps `SIGTERM` and `SIGINT`:
  1. Stops accepting incoming HTTP connections (`server.close()`).
  2. Waits for ongoing in-flight requests to complete (with a 10-second timeout).
  3. Drains and closes the `pg.Pool`.
  4. Exits with code `0`.

---

## 9. Background Cleanup Strategy

The database accumulates transient rows:
- `otp_codes`: Expired (> 5 min) or consumed.
- `refresh_tokens`: Revoked or expired (> 7/30 days).
- `admin_password_reset_tokens`: Used or expired (> 60 min).

### Options Analysis
1. **In-Process Scheduler (`node-cron` / `setInterval`):** Runs within the Express process. Lightweight, zero infrastructure setup, single process in dev.
2. **External CLI Task Runner (OS Cron / Windows Task Scheduler):** Separate process calling `npm run job:cleanup`. Prevents web server memory/CPU spikes.
3. **Database Extension (`pg_cron`):** Executes cleanup directly inside PostgreSQL. Highly performant, but requires custom Docker setup and locks logic into database configuration.

### Recommendation
- **In-process scheduler (`node-cron`)** initialized in `src/jobs/scheduler.ts` running once every hour during development.
- The same task is also exposed as an independent script (`npm run job:cleanup`) so production can seamlessly run it via an external cron or container worker without code modification.

---

## 10. Database Seeding Strategy

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
To prevent hardcoded credentials:
1. Seed script checks if any admin exists in `admin_users`. If an admin row exists, it skips execution.
2. Reads `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME`, and `SEED_ADMIN_INITIAL_PASSWORD` from `.env`.
3. If `SEED_ADMIN_INITIAL_PASSWORD` is omitted, the script generates a secure 16-character random password using `crypto.randomBytes()`.
4. Hashes the password using Argon2id.
5. Inserts the Super Admin row.
6. Prints the initial login email and plain password to the console with a reminder to update it upon first login.

---

## 11. Testing Strategy

### Framework Recommendation: Vitest
- **Vitest** is recommended over Jest due to native TypeScript support via esbuild, ultra-fast execution, zero-config module resolution, and seamless integration with modern Node.js.

### Testing Levels
1. **Unit Tests (`*.spec.ts`):**
   - Target Services and Utilities.
   - Fast, in-memory execution.
   - Mock all repository and integration calls.
2. **Integration Tests (`*.test.ts`):**
   - Target API endpoints and Repositories.
   - Executed against the real PostgreSQL container running on port `5433`.
   - **Database Isolation:** Tests run against a dedicated database `fuelpoint_test`. Each test suite runs migrations once, and individual tests execute within isolated transactions that roll back upon completion, or tables are truncated between suites using a database reset helper.

---

## 12. Local Docker Compose Architecture & README Outline

### Docker Compose Configuration (`docker-compose.yml`)
```yaml
services:
  postgres:
    image: postgres:18-alpine
    container_name: fuelpoint-postgres
    restart: unless-stopped
    ports:
      - "5433:5432"  # Host port 5433 mapped to container port 5432
    environment:
      POSTGRES_DB: fuelpoint
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data
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
   - `cp .env.example .env`
   - `npm run migrate`
   - `npm run seed`
   - `npm run dev`
4. **Environment Variables Reference:** Complete table of `.env` options.
5. **API Documentation:** Summary of route endpoints and authentication requirements.
6. **Testing:** How to execute unit and integration test suites.
7. **Windows Development Notes:** Port mapping and shell execution guidance.

---

## 13. Windows Development Notes

The project owner develops on Windows using `cmd`:
1. **Port Avoidance (Port 5433):** The host Windows machine already runs PostgreSQL 16 on port 5432. Docker Compose binds container port 5432 to host port **`5433`**.
2. **Cross-Platform NPM Scripts:** Use `cross-env` in `package.json` scripts where environment variables are injected (e.g., `cross-env NODE_ENV=test vitest`).
3. **Line Endings (CRLF vs LF):** Git repository configured with `.gitattributes` to ensure `.sql` migration files and `.env` files retain standard LF endings to avoid parser anomalies.
4. **Shell Execution:** All npm scripts use standard commands that execute equivalently in Windows `cmd.exe`, PowerShell, and bash.

---

## 14. Email & SMS Provider Setup

### Gmail SMTP Setup via Nodemailer
1. **Requirements:**
   - The owner uses a Gmail account.
   - 2-Step Verification must be enabled in Google Account settings.
   - Create an **App Password**: Navigate to *Security* $\rightarrow$ *2-Step Verification* $\rightarrow$ *App Passwords*. Generate an app password for "FuelPoint Backend".
   - Store the generated 16-character token in `.env` as `SMTP_PASSWORD`.
2. **Sending Limits:**
   - Free Gmail SMTP accounts are subject to Google's daily limit of 500 emails/day. This is more than adequate for single-station admin password resets and alerts.
3. **Provider Swappability (PROPOSED):**
   - The email subsystem is encapsulated behind `IEmailSender`:
     ```typescript
     export interface IEmailSender {
       sendPasswordReset(to: string, resetLink: string): Promise<void>;
     }
     ```
   - In development, the reset link is dispatched via Gmail SMTP **and** printed to the server console log.
   - If production requirements exceed 500 emails/day, the Gmail implementation can be substituted with SendGrid, Resend, or AWS SES without altering service code.

### SMS Strategy
- SMS provider selection is deferred.
- The `ISMSSender` interface provides a console logger implementation (`ConsoleSMSSender`) that prints OTP codes to stdout in development.

---

## 15. Open Questions

1. **Production Hosting Infrastructure:** Production hosting is deliberately undecided. Will the production deployment use a single container VPS (e.g. DigitalOcean Droplet, Hetzner), a managed container platform (e.g. Render, AWS App Runner), or serverless containers?
2. **SMS Gateway Provider Selection:** When mobile apps enter pilot testing, which Indian SMS gateway will be selected (e.g., MSG91, Fast2SMS, Twilio)? Note that commercial Indian SMS requires TRAI DLT registration and template approval.
3. **Session Revocation at Scale:** Refresh token checks currently execute via PostgreSQL. If transaction volume grows significantly, should active refresh tokens be cached in Redis for sub-millisecond validation?
4. **Admin Account Setup Workflow:** For future secondary admins, should an invitation email workflow be supported, or does the Super Admin generate initial credentials directly?

---

*End of backend structure proposal. Awaiting orchestrator instructions.*
