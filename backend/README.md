# FuelPoint — Backend

Backend REST API for the FuelPoint petrol pump management system built with **Node.js v22**, **Express**, and **PostgreSQL 18**.

---

## 1. Overview & Scope

The backend serves three clients sharing a single PostgreSQL database:

| Client                              | Interface Built By | Purpose                                                           |
| ----------------------------------- | ------------------ | ----------------------------------------------------------------- |
| **Admin Web Panel** (`../frontend`) | This Project       | Back-office administration, attendant management, reports, audits |
| **Worker Mobile App**               | Mobile Team        | Attendant POS: QR code scanning, fuelling input, payment outcomes |
| **Customer Mobile App**             | Mobile Team        | Customer self-registration, OTP login, QR loyalty code display    |

The mobile application screens are outside our development scope. The API endpoints those apps call (`/api/v1/worker/*`, `/api/v1/customer/*`, `/api/v1/auth/*`) are within our scope.

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

:: 4. Start backend in development mode (with hot reloading)
npm run dev
```

Verify that the server is running by querying the health endpoint:

```cmd
curl http://localhost:3000/api/v1/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2026-10-12T11:00:00.000Z",
  "database": "connected"
}
```

---

## 4. Environment Variables Reference

| Variable            | Default                 | Purpose                                                              |
| ------------------- | ----------------------- | -------------------------------------------------------------------- |
| `NODE_ENV`          | `development`           | Runtime environment (`development`, `production`, `test`)            |
| `PORT`              | `3000`                  | HTTP port for the Express application                                |
| `HOST`              | `0.0.0.0`               | Network binding interface                                            |
| `API_PREFIX`        | `/api/v1`               | URL prefix for all REST routes                                       |
| `CORS_ORIGIN`       | `http://localhost:5173` | Allowed frontend origin for CORS                                     |
| `DB_HOST`           | `127.0.0.1`             | PostgreSQL database host                                             |
| `DB_PORT`           | `5433`                  | Host port mapped to PostgreSQL 18 container                          |
| `DB_USER`           | `postgres`              | Database username                                                    |
| `DB_PASSWORD`       | `postgres`              | Database password                                                    |
| `DB_NAME`           | `fuelpoint`             | Database name                                                        |
| `JWT_ACCESS_SECRET` | _(Placeholder)_         | Secret for signing access tokens ($\ge 32$ characters in production) |
| `JWT_ACCESS_EXPIRY` | `15m`                   | Lifetime of access tokens                                            |
| `SMTP_HOST`         | `smtp.gmail.com`        | SMTP host for email dispatch                                         |
| `SMTP_PORT`         | `465`                   | SMTP SSL port                                                        |
| `SMTP_USER`         | `""`                    | Gmail account address                                                |
| `SMTP_PASSWORD`     | `""`                    | 16-character Google App Password                                     |
| `SMS_PROVIDER`      | `console`               | SMS provider adapter (`console` in development)                      |

---

## 5. API Documentation Summary

All endpoints are mounted under `/api/v1`:

- **Auth (`/api/v1/auth/*`):** Admin login, OTP requests/verification, token refresh, logout, password resets.
- **Admin (`/api/v1/admin/*`):** Customers, workers, groups, transactions, notifications, reports, audits, profile.
- **Worker (`/api/v1/worker/*`):** Attendant profile, QR scan prefill (`/scan`), transaction submission, payment status resolution.
- **Customer (`/api/v1/customer/*`):** Customer self-registration, QR retrieval, QR regeneration, transaction history, profile.
- **Health (`/api/v1/health`):** Server health check running `SELECT 1` on the database pool.

For the full specification, see [`../docs/api-proposal.md`](../docs/api-proposal.md).

---

## 6. Testing & Quality Commands

```cmd
:: Run unit and integration tests (against Docker database)
npm test

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

## 7. Windows Development Notes

- **Port Offset (127.0.0.1:5433):** The host Windows machine already runs PostgreSQL 16 on port 5432. The Docker Compose file maps container port 5432 strictly to `127.0.0.1:5433` to prevent collision.
- **Shell Compatibility:** All npm scripts use standard commands that execute equivalently in Windows `cmd.exe`, PowerShell, and bash.
- **Line Endings:** Files are formatted with standard LF line endings.

---

## 8. Gmail App Password Setup (for Production SMTP)

FuelPoint sends password reset links and security alert emails via Google Workspace / Gmail SMTP (`smtp.gmail.com:465` over SSL).

> **Note:** In local development (`NODE_ENV=development`), when `SMTP_USER` and `SMTP_PASSWORD` are left blank, emails are automatically logged to the development terminal (with clickable reset links) via `DevEmailLogger`.

To configure real email delivery in staging or production using Gmail:

1. **Enable 2-Step Verification:**
   - Sign in to your [Google Account](https://myaccount.google.com/).
   - Go to **Security** in the left sidebar.
   - Under **How you sign in to Google**, verify that **2-Step Verification** is turned on.
2. **Generate an App Password:**
   - Search for **App passwords** in the top search bar, or navigate to **Security** $\rightarrow$ **2-Step Verification** $\rightarrow$ **App passwords** (at the bottom of the page).
   - Enter an application name (e.g. `FuelPoint Backend` or `FuelPoint Staging`).
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
