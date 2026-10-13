# FuelPoint — Backend

Backend REST API for the FuelPoint petrol pump management system built with **Node.js v22**, **Express**, and **PostgreSQL 18**.

---

## 1. Overview & Scope

The backend serves three clients sharing a single PostgreSQL database:

| Client                              | Interface Built By | Purpose                                                                                  |
| ----------------------------------- | ------------------ | ---------------------------------------------------------------------------------------- |
| **Admin Web Panel** (`../frontend`) | This Project       | Back-office administration, attendant management, reports, audits, transactions override |
| **Worker Mobile App**               | Mobile Team        | Attendant POS: QR code scanning, fuelling input, payment outcomes                        |
| **Customer Mobile App**             | Mobile Team        | Customer self-registration, OTP login, QR loyalty code display, transaction history      |

The mobile application screens are outside our development scope. The API endpoints those apps call (`/api/v1/worker/*`, `/api/v1/customer/*`, `/api/v1/auth/*`) are fully implemented and verified within this backend.

---

## 2. Prerequisites

- **Node.js:** v22.15.0 or later (LTS)
- **Package Manager:** `npm` (npm v10+)
- **Container Runtime:** Docker Desktop (with WSL 2 on Windows)

---

## 3. Quick Start Guide

Run the following commands from the `backend/` directory:

```cmd
:: 1. Start PostgreSQL 18 in Docker (runs on 127.0.0.1:5433)
docker compose up -d

:: 2. Install dependencies
npm install

:: 3. Configure local environment variables
copy .env.example .env

:: 4. Run database migrations
npm run migrate

:: 5. Seed default discount group and initial super admin
npm run seed

:: 6. Start backend in development mode (with hot reloading)
npm run dev
```

Verify that the server is running by querying the health endpoint:

```cmd
curl http://localhost:5000/api/v1/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2026-10-13T12:00:00.000Z",
  "database": "connected"
}
```

---

## 4. Environment Variables Reference

| Variable                           | Default                 | Purpose                                                              |
| ---------------------------------- | ----------------------- | -------------------------------------------------------------------- |
| `NODE_ENV`                         | `development`           | Runtime environment (`development`, `production`, `test`)            |
| `PORT`                             | `5000`                  | HTTP port for the Express application                                |
| `HOST`                             | `0.0.0.0`               | Network binding interface                                            |
| `API_PREFIX`                       | `/api/v1`               | URL prefix for all REST routes                                       |
| `CORS_ORIGIN`                      | `http://localhost:5173` | Allowed frontend origin for CORS (supports credentials)              |
| `DB_HOST`                          | `127.0.0.1`             | PostgreSQL database host                                             |
| `DB_PORT`                          | `5433`                  | Host port mapped to PostgreSQL 18 container (offset from 5432)       |
| `DB_USER`                          | `postgres`              | Database username                                                    |
| `DB_PASSWORD`                      | `postgres`              | Database password                                                    |
| `DB_NAME`                          | `fuelpoint`             | Database name (`fuelpoint_test` for automated Vitest runs)           |
| `JWT_ACCESS_SECRET`                | _(Placeholder)_         | Secret for signing access tokens ($\ge 32$ characters in production) |
| `JWT_ACCESS_EXPIRY`                | `15m`                   | Lifetime of access tokens                                            |
| `ADMIN_REFRESH_TOKEN_EXPIRY_DAYS`  | `30`                    | Refresh token lifespan for Admin Web Panel                           |
| `MOBILE_REFRESH_TOKEN_EXPIRY_DAYS` | `90`                    | Refresh token lifespan for Mobile Apps                               |
| `SCAN_TICKET_SECRET`               | _(Placeholder)_         | Secret for signing 5-minute worker QR scan tickets                   |
| `SMTP_HOST`                        | `smtp.gmail.com`        | SMTP host for email dispatch                                         |
| `SMTP_PORT`                        | `465`                   | SMTP SSL port                                                        |
| `SMTP_USER`                        | `""`                    | Gmail account address                                                |
| `SMTP_PASSWORD`                    | `""`                    | 16-character Google App Password                                     |
| `SMS_PROVIDER`                     | `console`               | SMS provider adapter (`console` in dev, mock in test)                |

---

## 5. Postman Collection & Local Testing

The backend includes a comprehensive, production-ready Postman collection and environment in the `postman/` directory:

- **Collection:** `postman/FuelPoint_API.postman_collection.json`
- **Environment:** `postman/FuelPoint_Local.postman_environment.json`

### Importing into Postman

1. Open Postman.
2. Click **Import** $\rightarrow$ select both `FuelPoint_API.postman_collection.json` and `FuelPoint_Local.postman_environment.json`.
3. Select the **FuelPoint Local** environment in the environment dropdown.
4. Execute `01. Auth` $\rightarrow$ `Admin Login`: the test script will automatically store `adminToken` in your environment, authenticating all subsequent admin requests.

---

## 6. Testing & Quality Commands

```cmd
:: Run all Vitest integration and unit test suites (against Docker fuelpoint_test)
npm test

:: Run end-to-end integration test flow specifically
npx vitest run src/tests/e2e.test.ts

:: Run TypeScript type checking
npm run typecheck

:: Run ESLint code checks
npm run lint

:: Automatically format code with Prettier
npm run format

:: Build TypeScript to dist/
npm run build
```

---

## 7. Security Architecture & Hardening

1. **Password Hashing:** Argon2id via `@node-rs/argon2` with high-security parameters (memory cost 65536 KiB, time cost 3, parallelism 4).
2. **Timing-Safe OTP Unknown Destination (D52):** Requesting an OTP for an unregistered phone in login mode returns an identical `{ message: "Code sent", cooldown: 60 }` without sending SMS or storing rows, preventing user enumeration.
3. **Session Cookies & Token Delivery:**
   - Admin Web Panel: In-memory short-lived (15m) access tokens; long-lived (30d) refresh tokens transmitted via `httpOnly`, `Secure` (production), `SameSite=Strict`, path-restricted cookies.
   - Mobile Apps: Access and refresh tokens returned in JSON payloads for secure OS Keychain/Keystore persistence.
4. **Attendant Signed Scan Tickets:** Attendants cannot fabricate discounts or inject arbitrary customer IDs. `POST /worker/scan` verifies customer QR entropy ($\ge 128$ bits) and issues a 5-minute HMAC-SHA256 signed `scanTicket` bound to customer ID, worker ID, and discount percentage.
5. **Idempotent Submission:** Worker transaction submissions require a client-generated UUID `id`. Duplicate requests with matching payloads safely return `200 OK` without creating duplicate transactions or discounts.
6. **Rate Limiting:**
   - General API limiter: 300 requests per 15 minutes per IP.
   - Auth endpoint limiter: 20 login attempts per 15 minutes per IP.
   - OTP limiter: max 10 registration OTPs/hour per IP; max 5 OTPs/hour per phone; 60-second cooldown between resends.
   - Scan limiter: max 60 QR scans per minute per worker.
7. **Status Enforcement Guards:**
   - Inactive customers cannot log in, generate QR codes, or have transactions submitted against them.
   - Offline or suspended workers cannot log in, refresh tokens, scan QR codes, or submit transactions.
   - Setting a worker or customer to `inactive`/`suspended` immediately revokes all their active refresh tokens.
8. **Logging Redaction:** Pino structured logger automatically redacts sensitive keys: `password`, `code`, `token`, `refreshToken`, `accessToken`, `jwt`, `secret`, `authorization`, `cookie`.

---

## 8. Windows Development Notes

- **Port Offset (127.0.0.1:5433):** The host Windows machine already runs PostgreSQL 16 on port 5432. The Docker Compose file maps container port 5432 strictly to `127.0.0.1:5433` to prevent port collision.
- **Shell Compatibility:** All npm scripts use standard commands that execute equivalently in Windows `cmd.exe`, PowerShell, and bash.
- **Line Endings:** Files are formatted with standard LF line endings.

---

## 9. Gmail App Password Setup (for Production SMTP)

FuelPoint sends password reset links and security alert emails via Google Workspace / Gmail SMTP (`smtp.gmail.com:465` over SSL).

> **Note:** In local development (`NODE_ENV=development`), when `SMTP_USER` and `SMTP_PASSWORD` are left blank, emails are automatically logged to the development terminal (with clickable reset links) via `DevEmailLogger`.

To configure real email delivery in staging or production using Gmail:

1. **Enable 2-Step Verification:**
   - Sign in to your [Google Account](https://myaccount.google.com/).
   - Go to **Security** in the left sidebar.
   - Under **How you sign in to Google**, verify that **2-Step Verification** is turned on.
2. **Generate an App Password:**
   - Search for **App passwords** in the top search bar, or navigate to **Security** $\rightarrow$ **2-Step Verification** $\rightarrow$ **App passwords** (at the bottom of the page).
   - Enter an application name (e.g. `FuelPoint Backend`).
   - Click **Create**.
   - Google will display a 16-character passcode (formatted as four 4-letter groups, e.g., `abcd efgh ijkl mnop`).
3. **Configure Environment Variables:**
   - Copy the 16 characters (without spaces).
   - In your `.env` file (or deployment environment secrets):
     ```env
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=465
     SMTP_USER=your-email@gmail.com
     SMTP_PASSWORD=abcdefghijklmnop
     ```
   - **Never** commit `.env` or the 16-character app password to source control.
