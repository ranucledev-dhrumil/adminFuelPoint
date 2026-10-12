# FuelPoint — REST API Specification & Proposal

> **Status:** Draft Proposal for Owner Review  
> **Scope:** Full REST API under `/api/v1` for Admin Web Panel, Worker Mobile App, and Customer Mobile App.  
> **Date:** 2026-10-12  
> **Author:** Antigravity / Engineering  
> **References:** `docs/db-schema-proposal.md` (v5, signed off), `docs/backend-structure-proposal.md`

---

## 0. Architecture Principles & Scope

### 0.1 High-Level Architecture
The backend exposes a single versioned REST API mounted at `/api/v1`. It services three distinct clients sharing the same underlying PostgreSQL 18 database:
1. **Admin Web Panel (`/api/v1/admin/*`):** Full station back-office management, audits, reports, customer/worker oversight.
2. **Worker Mobile App (`/api/v1/worker/*`):** Pump attendant POS app for scanning customer QR tokens, submitting transactions, and marking payment outcomes.
3. **Customer Mobile App (`/api/v1/customer/*`):** Self-registration, loyalty QR code display, and QR regeneration.
4. **Shared Authentication (`/api/v1/auth/*`):** OTP requests/verification, admin password login, token refresh, and logout.

---

## 1. Conventions & Standards

### 1.1 HTTP Methods & Status Codes
- `GET`: Retrieve resource(s). Returns `200 OK`.
- `POST`: Create resource or execute RPC action (login, verify, scan). Returns `200 OK` or `201 Created`.
- `PATCH`: Partially update resource. Returns `200 OK`.
- `DELETE`: Soft-delete or remove resource. Returns `200 OK` (with deleted entity summary) or `204 No Content`.

Standard HTTP status codes:
- `200 OK`: Successful retrieval or synchronous update.
- `201 Created`: Entity successfully created.
- `204 No Content`: Successful action with no return payload.
- `400 Bad Request`: Malformed JSON or semantic business constraint violation.
- `401 Unauthorized`: Missing, expired, or invalid access token.
- `403 Forbidden`: Actor authenticated but lacks role permissions or account is suspended/inactive.
- `404 Not Found`: Target entity or route does not exist.
- `409 Conflict`: Conflict with existing state (e.g., duplicate unique field).
- `422 Unprocessable Entity`: Schema/field validation error (Zod parse failure).
- `429 Too Many Requests`: Rate limit exceeded.
- `500 Internal Server Error`: Unhandled server exception.

---

### 1.2 Pagination, Sorting, Filtering & Search
All list endpoints support standard query parameters:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | 1-based page number. |
| `limit` | integer | `20` | Items per page (min 1, max 100). |
| `sort_by` | string | `created_at` | Field to sort by. Whitelisted per endpoint. |
| `order` | string | `desc` | `asc` or `desc`. |
| `q` | string | `""` | Case-insensitive search string matching name, phone, or email. |

Standard Paginated Response Envelope:
```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

### 1.3 Dates, Times & Timezones
- **Format:** All timestamps in JSON requests and responses use **ISO 8601** UTC format: `YYYY-MM-DDTHH:mm:ss.sssZ` (e.g. `2026-10-12T10:30:00.000Z`).
- **India Time Standard (D49):** All "today" counters, KPI aggregations, and daily chart series buckets are bounded using **`Asia/Kolkata` (IST, UTC+5:30)**. Query filters accepting date ranges (`from`, `to`) accept either `YYYY-MM-DD` or full ISO strings and are interpreted within the IST day boundary (`00:00:00.000` to `23:59:59.999` IST).

---

### 1.4 Money & Numeric Precision
- **String Representation (Schema v5):** All currency amounts (`amount`, `discount_amount`) and fuel volume (`litres`) are returned in JSON as **strings** with 2 decimal places (e.g. `"1250.00"`, `"45.25"`). This prevents IEEE 754 floating-point precision loss in JavaScript clients.
- **Percentages:** `discount_percent` is returned as a number or numeric string formatted to 2 decimals (e.g., `5.00`).
- **Calculation & Rounding (D31):** Evaluated as `ROUND(amount * discount_percent / 100, 2)` half-up.

---

### 1.5 Standard Error Envelope
All error responses conform to a predictable envelope:
```json
{
  "error": {
    "code": "WORKER_SUSPENDED",
    "message": "This worker account is suspended and cannot perform operations.",
    "details": null
  }
}
```
Validation errors (`422 Unprocessable Entity`) include field details:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input validation failed.",
    "details": [
      {
        "field": "phone",
        "issue": "Phone number must be a valid 10-digit Indian mobile number."
      }
    ]
  }
}
```

---

### 1.6 Rate Limits
- **Global API Limit:** 100 requests per minute per IP.
- **OTP Request Limits (D47, D50, D52):**
  - **Login OTP:** Max 5 requests per hour per destination; 60-second cooldown.
  - **Registration OTP:** Max 10 requests per hour per client IP (`request_ip`); 5 per hour per destination; 60-second cooldown.
  - **OTP Verification:** Max 5 incorrect verification attempts per code before invalidation.
- **Admin Password Login:** 5 failed attempts per 15 minutes per email triggers temporary delay or lockout.

---

### 1.7 Idempotency for Submitting Transactions (D53)
When pump attendants operate under poor network connectivity, a transaction submission POST may time out and be retried.
- **Mechanism (Option A - Recommended):** The worker mobile app generates a client-side UUID v4 and sends it as `id` in the `POST /api/v1/worker/transactions` request.
- **Behavior:**
  - If no row with that `id` exists, it inserts the new transaction (`201 Created`).
  - If a row with that `id` already exists for that worker, the backend detects the primary key duplicate and returns the existing transaction row (`200 OK`) without re-executing business logic or creating duplicate transactions.

---

### 1.8 Token Delivery & Session Strategy
The backend uses **short-lived access tokens (15m)** and **stored hashed refresh tokens** (7 days for Admin, 30 days for Customer/Worker).

#### Client-Specific Delivery Comparison:
| Client | Access Token Delivery | Refresh Token Delivery | Storage Strategy | Trade-off / Rationale |
|---|---|---|---|---|
| **Worker & Customer Mobile Apps** | `Authorization: Bearer <token>` header | JSON response body (`refreshToken`) | Secure OS Keychain / EncryptedSharedPreferences | Native mobile apps handle Authorization headers natively; immune to browser cookie vulnerabilities. |
| **Admin Web Panel (Option 1): Bearer Header** | `Authorization: Bearer <token>` header | JSON response body | `sessionStorage` or in-memory | Simple, but vulnerable to XSS token theft if long-lived tokens are stored in `localStorage`. |
| **Admin Web Panel (Option 2 - Recommended): httpOnly Cookie** | `Authorization: Bearer <token>` header (in-memory) | `httpOnly`, `Secure`, `SameSite=Strict` cookie (`fuelpoint_refresh_token`) | Browser cookie jar (managed automatically) | Prevents XSS token exfiltration. The short-lived access token is stored only in React memory. On refresh/tab reload, the browser automatically sends the cookie to `/api/v1/auth/refresh` to restore the session. |

**Recommendation:**
- **Mobile apps:** Bearer header + JSON refresh token.
- **Admin Web Panel:** In-memory access token + `httpOnly` secure cookie for the refresh token. (The endpoint `/api/v1/auth/refresh` accepts either the cookie OR a JSON `{ "refreshToken": "..." }` body).

---

## 2. Complete Endpoints Table

### 2.1 Shared Authentication Endpoints (`/api/v1/auth/*`)

| Method & Path | Caller | Request Parameters & Body | Success Response | Error Cases | DB Read / Written | Audit Log Action | Notifications | Frontend / Page Replaced |
|---|---|---|---|---|---|---|---|---|
| `POST /api/v1/auth/otp/request` | Public | **Body:**<br>`destination`: string (10 digits or E.164)<br>`purpose`: `'login' \| 'register'`<br>`channel`: `'sms' \| 'email'` (default `'sms'`)<br>`actor_type`: `'customer' \| 'worker'` | `200 OK`<br>`{ "message": "Code sent", "cooldown": 60 }` | `400` Invalid channel/purpose<br>`422` Invalid phone<br>`429` Cooldown or hourly rate limit | **Read:** `customers`, `workers`, `otp_codes`<br>**Write:** `otp_codes` (only if registered or register purpose) | *None* (timing-safe; SMS dispatched async) | *None* | `routes/index.tsx` (OTP flows) |
| `POST /api/v1/auth/otp/verify` | Public | **Body:**<br>`destination`: string (E.164)<br>`code`: string (6 digits)<br>`purpose`: `'login' \| 'register'`<br>`actor_type`: `'customer' \| 'worker'` | `200 OK`<br>`{ "accessToken": "...", "refreshToken": "...", "actor": { "id": "...", "role": "...", "name": "..." } }` | `400` Expired / max attempts<br>`401` Invalid code<br>`403` Account inactive/suspended | **Read:** `otp_codes`, `customers`, `workers`<br>**Write:** `otp_codes` (consumed_at), `refresh_tokens`, `workers` (first_login_at if applicable) | `worker.status_changed` (if first login triggers) | If worker first login: `worker` notification | Mobile login screen |
| `POST /api/v1/auth/admin/login` | Public | **Body:**<br>`email`: string (valid email)<br>`password`: string | `200 OK`<br>`{ "accessToken": "...", "refreshToken": "...", "admin": { ... } }`<br>*(Sets httpOnly refresh cookie)* | `401` Invalid email/password<br>`403` Admin deactivated (`is_active = FALSE`) | **Read:** `admin_users`<br>**Write:** `admin_users` (last_login_at), `refresh_tokens` | `admin.login` or `admin.login_failed` | *None* | `admin-store.tsx`: `login()`<br>`routes/index.tsx` |
| `POST /api/v1/auth/admin/forgot-password` | Public | **Body:**<br>`email`: string | `200 OK`<br>`{ "message": "If the email is registered, a password reset link has been sent." }` | `429` Rate limit | **Read:** `admin_users`, `admin_password_reset_tokens`<br>**Write:** `admin_password_reset_tokens` | *None* | *None* | `routes/index.tsx` (Forgot Password dialog) |
| `POST /api/v1/auth/admin/reset-password` | Public | **Body:**<br>`token`: string (token value)<br>`newPassword`: string (min 8 chars) | `200 OK`<br>`{ "message": "Password successfully reset. You may now log in." }` | `400` Expired or already used token<br>`422` Password too weak | **Read:** `admin_password_reset_tokens`, `admin_users`<br>**Write:** `admin_password_reset_tokens` (used_at), `admin_users` (password_hash), `refresh_tokens` (revokes all admin tokens) | `admin.password_changed` | *None* | `routes/index.tsx` |
| `POST /api/v1/auth/refresh` | Public | **Headers / Cookie / Body:**<br>`refreshToken`: string (or cookie `fuelpoint_refresh_token`) | `200 OK`<br>`{ "accessToken": "...", "refreshToken": "..." }` | `401` Token revoked / expired / invalid<br>`403` Actor deactivated / suspended | **Read:** `refresh_tokens`, actor table (`admin_users`, `customers`, `workers`)<br>**Write:** `refresh_tokens` (rotates token) | *None* (if reuse detected, chain revoked) | *None* | `admin-store.tsx` session restore |
| `POST /api/v1/auth/logout` | Authenticated | **Body / Cookie:**<br>`refreshToken`: string (optional, defaults to session cookie)<br>`allDevices`: boolean (default `false`) | `200 OK`<br>`{ "message": "Logged out successfully" }`<br>*(Clears cookie)* | `401` Unauthenticated | **Read:** `refresh_tokens`<br>**Write:** `refresh_tokens` (revoked_at = now()) | `admin.logout` (if admin) | *None* | `admin-store.tsx`: `logout()` |

---

### 2.2 Customer Mobile App Endpoints (`/api/v1/customer/*`)

| Method & Path | Caller | Request Parameters & Body | Success Response | Error Cases | DB Read / Written | Audit Log Action | Notifications | Frontend / Page Replaced |
|---|---|---|---|---|---|---|---|---|
| `POST /api/v1/customer/register` | Public | **Body:**<br>`phone`: string (10 digits or E.164)<br>`name`: string (min 2 chars)<br>`code`: string (6-digit OTP verified) | `201 Created`<br>`{ "accessToken": "...", "refreshToken": "...", "customer": { "id": "...", "name": "...", "phone": "...", "qrToken": "...", "status": "active" } }` | `400` OTP invalid / expired<br>`409` Phone already registered<br>`422` Validation failure | **Read:** `otp_codes`, `groups` (default group), `customers`<br>**Write:** `customers`, `otp_codes` (consumed_at), `refresh_tokens`, `notifications` | `customer.created` | `registration` notification created | Customer Mobile App (Self-Registration) |
| `GET /api/v1/customer/qr` | Customer | **Headers:** `Authorization: Bearer <token>` | `200 OK`<br>`{ "qrToken": "opaque_random_token_str", "name": "John Doe", "status": "active" }` | `401` Invalid token<br>`403` Customer inactive | **Read:** `customers` | *None* | *None* | Customer Mobile App (QR Display Screen) |
| `POST /api/v1/customer/qr/regenerate` | Customer | **Headers:** `Authorization: Bearer <token>` | `200 OK`<br>`{ "qrToken": "new_random_token_str", "regeneratedAt": "2026-10-12T10:30:00.000Z" }` | `401` Invalid token<br>`403` Customer inactive | **Read:** `customers`<br>**Write:** `customers` (qr_token updated atomically) | `customer.qr_regenerated` (old and new token never logged) | *None* | Customer Mobile App (Regenerate QR Action) |

---

### 2.3 Worker Mobile App Endpoints (`/api/v1/worker/*`)

| Method & Path | Caller | Request Parameters & Body | Success Response | Error Cases | DB Read / Written | Audit Log Action | Notifications | Frontend / Page Replaced |
|---|---|---|---|---|---|---|---|---|
| `POST /api/v1/worker/scan` | Worker | **Body:**<br>`qrToken`: string (token read from customer QR) | `200 OK`<br>`{ "customerId": "...", "customerName": "Ramesh K.", "groupId": "...", "groupName": "Gold Fleet", "discountPercent": "5.00" }` | `403` Worker suspended (`WORKER_SUSPENDED`)<br>`404` QR not found (`CUSTOMER_NOT_FOUND`)<br>`422` Inactive customer (`CUSTOMER_INACTIVE`) | **Read:** `workers`, `customers`, `groups`<br>**Write:** `audit_logs` (if scan rejected) | If rejected: `scan.rejected` with reason code (`CUSTOMER_NOT_FOUND`, `CUSTOMER_INACTIVE`, `WORKER_SUSPENDED`) | *None* | Worker Mobile App (Prefill Scan Screen) |
| `POST /api/v1/worker/transactions` | Worker | **Body:**<br>`id`: string (UUID v4 client-generated for idempotency)<br>`customerId`: string (UUID)<br>`amount`: string (numeric > 0)<br>`litres`: string (optional numeric > 0)<br>`fuelType`: `'Petrol' \| 'Diesel' \| 'CNG'` (optional) | `201 Created` (or `200 OK` on duplicate retry)<br>`{ "id": "...", "status": "pending", "amount": "1000.00", "discountPercent": "5.00", "discountAmount": "50.00", "netPayable": "950.00", "submittedAt": "..." }` | `400` Amount $\le 0$<br>`403` Worker suspended or Customer inactive<br>`404` Customer not found | **Read:** `workers`, `customers`, `groups`<br>**Write:** `transactions`, `workers` (last_activity_at), `audit_logs` | `transaction.created` | *None* | Worker Mobile App (Submit Transaction) |
| `PATCH /api/v1/worker/transactions/:id/status` | Worker | **Path:** `id` (UUID)<br>**Body:**<br>`status`: `'success' \| 'failed'`<br>`failureReason`: string (optional) | `200 OK`<br>`{ "id": "...", "status": "success", "resolvedAt": "...", "updatedAt": "..." }` | `400` Transition to `pending` forbidden<br>`403` Worker suspended<br>`404` Transaction not found | **Read:** `transactions`, `workers`<br>**Write:** `transactions`, `customers` (last_activity_at recalculated if moving to/from success), `audit_logs` | `transaction.status_changed` (records old/new status, worker actor) | *None* | Worker Mobile App (Mark Success / Failed Screen) |

---

### 2.4 Admin Web Panel Endpoints (`/api/v1/admin/*`)

#### Admin Profile & Security
| Method & Path | Caller | Request Parameters & Body | Success Response | Error Cases | DB Read / Written | Audit Log Action | Frontend Service / Page |
|---|---|---|---|---|---|---|---|
| `GET /api/v1/admin/profile` | Admin | *None* | `200 OK`<br>`{ "id": "...", "name": "...", "email": "...", "phone": "...", "role": "Super Admin", "location": "...", "initials": "SA", "joinedAt": "..." }` | `401` Unauthorized | **Read:** `admin_users` | *None* | `adminService.getProfile()`<br>`_admin.profile.tsx` |
| `PATCH /api/v1/admin/profile` | Admin | **Body:**<br>`name`: string (optional)<br>`phone`: string (optional, 10 digits)<br>`location`: string (optional) | `200 OK`<br>`{ "profile": { ... } }` | `422` Validation failure | **Read:** `admin_users`<br>**Write:** `admin_users`, `audit_logs` | `admin.profile_updated` | `admin-store.tsx`: `updateProfile()`<br>`_admin.profile.tsx` |
| `POST /api/v1/admin/profile/change-password` | Admin | **Body:**<br>`currentPassword`: string<br>`newPassword`: string (min 8 chars) | `200 OK`<br>`{ "message": "Password changed successfully." }` | `400` Current password incorrect<br>`422` Password too weak | **Read:** `admin_users`<br>**Write:** `admin_users` (password_hash), `audit_logs` | `admin.password_changed` | `_admin.profile.tsx` (Change Password tab) |

#### Dashboard & Analytics
| Method & Path | Caller | Request Parameters & Body | Success Response | Error Cases | DB Read / Written | Audit Log Action | Frontend Service / Page |
|---|---|---|---|---|---|---|---|
| `GET /api/v1/admin/dashboard/overview` | Admin | *None* | `200 OK`<br>`{ "totalCustomers": 120, "totalWorkers": 8, "activeWorkers": 6, "totalGroups": 4, "totalTransactions": 1420, "totalDiscount": "24500.00", "totalRevenue": "489000.00", "todayTransactions": 38, "todayDiscount": "650.00", "newRegistrations7d": 14, "activeCustomers": 115, "usedPumpCustomers": 98, "unassignedCustomers": 12, "avgDiscountPercent": 5.01 }` | `401` Unauthorized | **Read:** `customers`, `workers`, `groups`, `transactions` | *None* | `adminService.buildOverview()`<br>`_admin.dashboard.tsx` |
| `GET /api/v1/admin/dashboard/series` | Admin | **Query:**<br>`days`: integer (`7`, `30`, or `90`, default `7`) | `200 OK`<br>`{ "series": [ { "date": "2026-10-12", "label": "12 Oct", "transactions": 42, "discount": "750.00", "registrations": 3, "revenue": "12400.00" }, ... ] }` | `400` Invalid days | **Read:** `transactions`, `customers` | *None* | `adminService.buildSeries()`<br>`_admin.dashboard.tsx` |
| `GET /api/v1/admin/dashboard/worker-activity` | Admin | *None* | `200 OK`<br>`{ "workers": [ { "id": "...", "name": "Rajesh", "scans": 142, "transactions": 138 }, ... ] }` | `401` Unauthorized | **Read:** `workers`, `transactions` | *None* | `adminService.workerActivity()`<br>`_admin.dashboard.tsx` |
| `GET /api/v1/admin/dashboard/group-distribution` | Admin | *None* | `200 OK`<br>`{ "groups": [ { "id": "...", "name": "VIP", "discountPercent": "10.00", "active": true, "customers": 45, "transactions": 210, "discountGenerated": "12500.00" }, ... ] }` | `401` Unauthorized | **Read:** `groups`, `customers`, `transactions` | *None* | `adminService.groupDistribution()`<br>`_admin.dashboard.tsx` |

#### Customers Management
| Method & Path | Caller | Request Parameters & Body | Success Response | Error Cases | DB Read / Written | Audit Log Action | Frontend Service / Page |
|---|---|---|---|---|---|---|---|
| `GET /api/v1/admin/customers` | Admin | **Query:** `page`, `limit`, `sort_by`, `order`, `q`, `status`, `group_id` | `200 OK`<br>`{ "data": [ { "id": "...", "name": "...", "phone": "...", "email": "...", "vehicle": "...", "groupId": "...", "groupName": "...", "status": "active", "registeredAt": "...", "lastActivity": "...", "transactions": 12, "totalSpend": "14500.00", "discountReceived": "725.00" } ], "pagination": { ... } }` | `400` Bad params | **Read:** `customers`, `groups`, `transactions` | *None* | `adminService.getCustomers()`<br>`_admin.customers.tsx` |
| `GET /api/v1/admin/customers/:id` | Admin | **Path:** `id` (UUID) | `200 OK`<br>`{ "customer": { ... }, "recentTransactions": [ ... ] }` | `404` Not found | **Read:** `customers`, `groups`, `transactions` | *None* | Customer Detail Dialog in `_admin.customers.tsx` |
| `POST /api/v1/admin/customers` | Admin | **Body:**<br>`name`: string<br>`phone`: string (10 digits)<br>`email`: string (optional)<br>`vehicle`: string (optional)<br>`groupId`: string (optional, defaults to default group) | `201 Created`<br>`{ "customer": { ... } }` | `409` Phone in use<br>`422` Validation fail | **Read:** `groups`, `customers`<br>**Write:** `customers`, `audit_logs`, `notifications` | `customer.created` | `admin-store.tsx`: `saveCustomer()`<br>`_admin.customers.tsx` |
| `PATCH /api/v1/admin/customers/:id` | Admin | **Path:** `id`<br>**Body:** `name`, `phone`, `email`, `vehicle` | `200 OK`<br>`{ "customer": { ... } }` | `404` Not found<br>`409` Duplicate phone | **Read:** `customers`<br>**Write:** `customers`, `audit_logs` | `customer.updated` | `admin-store.tsx`: `saveCustomer()`<br>`_admin.customers.tsx` |
| `PATCH /api/v1/admin/customers/:id/status` | Admin | **Path:** `id`<br>**Body:**<br>`status`: `'active' \| 'inactive'` | `200 OK`<br>`{ "customer": { "id": "...", "status": "inactive" } }` | `400` Invalid status<br>`404` Not found | **Read:** `customers`<br>**Write:** `customers`, `refresh_tokens` (if inactive, revokes tokens), `audit_logs` | `customer.status_changed` | Status toggle in `_admin.customers.tsx` |
| `PATCH /api/v1/admin/customers/:id/group` | Admin | **Path:** `id`<br>**Body:**<br>`groupId`: string (UUID) | `200 OK`<br>`{ "customer": { "id": "...", "groupId": "...", "groupName": "..." } }` | `404` Customer or Group not found | **Read:** `customers`, `groups`<br>**Write:** `customers`, `audit_logs` | `customer.group_assigned` | `admin-store.tsx`: `assignCustomerGroup()`<br>`_admin.customers.tsx` |
| `DELETE /api/v1/admin/customers/:id` | Admin | **Path:** `id` | `200 OK`<br>`{ "message": "Customer deleted successfully" }` | `404` Not found | **Read:** `customers`<br>**Write:** `customers` (deleted_at = now()), `refresh_tokens` (revoked), `audit_logs` | `customer.deleted` | `admin-store.tsx`: `deleteCustomer()`<br>`_admin.customers.tsx` |

#### Workers Management
| Method & Path | Caller | Request Parameters & Body | Success Response | Error Cases | DB Read / Written | Audit Log Action | Frontend Service / Page |
|---|---|---|---|---|---|---|---|
| `GET /api/v1/admin/workers` | Admin | **Query:** `page`, `limit`, `sort_by`, `order`, `q`, `status`, `shift` | `200 OK`<br>`{ "data": [ { "id": "...", "name": "...", "email": "...", "phone": "...", "shift": "Morning", "status": "active", "joinedAt": "...", "firstLoginAt": "...", "scans": 142, "transactions": 138, "customersScanned": 89, "discountProcessed": "6500.00", "lastActivity": "..." } ], "pagination": { ... } }` | `400` Bad params | **Read:** `workers`, `transactions` | *None* | `adminService.getWorkers()`<br>`_admin.workers.tsx` |
| `GET /api/v1/admin/workers/:id` | Admin | **Path:** `id` (UUID) | `200 OK`<br>`{ "worker": { ... }, "recentTransactions": [ ... ] }` | `404` Not found | **Read:** `workers`, `transactions` | *None* | Worker Detail Dialog in `_admin.workers.tsx` |
| `POST /api/v1/admin/workers` | Admin | **Body:**<br>`name`: string<br>`phone`: string (10 digits)<br>`email`: string<br>`shift`: `'Morning' \| 'Evening' \| 'Night'`<br>`status`: `'active' \| 'offline' \| 'suspended'` (default `'active'`) | `201 Created`<br>`{ "worker": { ... } }` | `409` Phone or email already registered<br>`422` Validation fail | **Read:** `workers`<br>**Write:** `workers`, `audit_logs` | `worker.created` | `admin-store.tsx`: `saveWorker()`<br>`_admin.workers.tsx` |
| `PATCH /api/v1/admin/workers/:id` | Admin | **Path:** `id`<br>**Body:** `name`, `phone`, `email`, `shift` | `200 OK`<br>`{ "worker": { ... } }` | `404` Not found<br>`409` Duplicate phone/email | **Read:** `workers`<br>**Write:** `workers`, `audit_logs` | `worker.updated` | `admin-store.tsx`: `saveWorker()`<br>`_admin.workers.tsx` |
| `PATCH /api/v1/admin/workers/:id/status` | Admin | **Path:** `id`<br>**Body:**<br>`status`: `'active' \| 'offline' \| 'suspended'` | `200 OK`<br>`{ "worker": { "id": "...", "status": "suspended" } }` | `400` Invalid status<br>`404` Not found | **Read:** `workers`<br>**Write:** `workers`, `refresh_tokens` (if suspended, revokes tokens), `audit_logs` | `worker.status_changed` | Status dropdown in `_admin.workers.tsx` |
| `DELETE /api/v1/admin/workers/:id` | Admin | **Path:** `id` | `200 OK`<br>`{ "message": "Worker deleted successfully" }` | `404` Not found | **Read:** `workers`<br>**Write:** `workers` (deleted_at = now()), `refresh_tokens` (revoked), `audit_logs` | `worker.deleted` | `admin-store.tsx`: `deleteWorker()`<br>`_admin.workers.tsx` |

#### Groups Management
| Method & Path | Caller | Request Parameters & Body | Success Response | Error Cases | DB Read / Written | Audit Log Action | Frontend Service / Page |
|---|---|---|---|---|---|---|---|
| `GET /api/v1/admin/groups` | Admin | *None* | `200 OK`<br>`{ "groups": [ { "id": "...", "name": "...", "discountPercent": "5.00", "description": "...", "active": true, "isDefault": false, "customerCount": 42, "createdAt": "..." } ] }` | `401` Unauthorized | **Read:** `groups`, `customers` | *None* | `adminService.getGroups()`<br>`_admin.groups.tsx` |
| `POST /api/v1/admin/groups` | Admin | **Body:**<br>`name`: string<br>`discountPercent`: number (0 to 100)<br>`description`: string (optional)<br>`active`: boolean (default `true`) | `201 Created`<br>`{ "group": { ... } }` | `409` Duplicate name<br>`422` Percent out of range | **Read:** `groups`<br>**Write:** `groups`, `audit_logs` | `group.created` | `admin-store.tsx`: `saveGroup()`<br>`_admin.groups.tsx` |
| `PATCH /api/v1/admin/groups/:id` | Admin | **Path:** `id`<br>**Body:** `name`, `discountPercent`, `description` | `200 OK`<br>`{ "group": { ... } }` | `400` Default group discount cannot change from 0<br>`404` Not found<br>`409` Duplicate name | **Read:** `groups`<br>**Write:** `groups`, `audit_logs` | `group.updated` | `admin-store.tsx`: `saveGroup()`<br>`_admin.groups.tsx` |
| `PATCH /api/v1/admin/groups/:id/toggle-active` | Admin | **Path:** `id` | `200 OK`<br>`{ "group": { "id": "...", "active": false } }` | `400` Default group cannot be deactivated (D42)<br>`404` Not found | **Read:** `groups`<br>**Write:** `groups`, `audit_logs` | `group.toggled` | `admin-store.tsx`: `toggleGroupActive()`<br>`_admin.groups.tsx` |
| `DELETE /api/v1/admin/groups/:id` | Admin | **Path:** `id` | `200 OK`<br>`{ "message": "Group deleted; members reassigned to default group" }` | `400` Default group cannot be deleted (D42)<br>`404` Not found | **Read:** `groups`<br>**Write:** `customers` (reassigns members to default group), `groups` (deleted_at = now()), `audit_logs` | `group.deleted` | `admin-store.tsx`: `deleteGroup()`<br>`_admin.groups.tsx` |

#### Transactions Management
| Method & Path | Caller | Request Parameters & Body | Success Response | Error Cases | DB Read / Written | Audit Log Action | Frontend Service / Page |
|---|---|---|---|---|---|---|---|
| `GET /api/v1/admin/transactions` | Admin | **Query:** `page`, `limit`, `sort_by`, `order`, `status`, `customerId`, `workerId`, `groupId`, `from`, `to` | `200 OK`<br>`{ "data": [ { "id": "...", "customerId": "...", "customerName": "...", "workerId": "...", "workerName": "...", "groupId": "...", "status": "success", "amount": "1000.00", "discountPercent": "5.00", "discountAmount": "50.00", "litres": "10.00", "fuel": "Petrol", "failureReason": null, "submittedAt": "...", "resolvedAt": "..." } ], "pagination": { ... } }` | `400` Invalid query | **Read:** `transactions`, `customers`, `workers` | *None* | `adminService.getTransactions()`<br>`_admin.reports.tsx` |
| `GET /api/v1/admin/transactions/:id` | Admin | **Path:** `id` (UUID) | `200 OK`<br>`{ "transaction": { ... }, "statusHistory": [ ... ] }` | `404` Not found | **Read:** `transactions`, `customers`, `workers`, `audit_logs` | *None* | Transaction Detail Dialog |
| `PATCH /api/v1/admin/transactions/:id/status` | Admin | **Path:** `id`<br>**Body:**<br>`status`: `'success' \| 'failed'`<br>`failureReason`: string (optional) | `200 OK`<br>`{ "transaction": { "id": "...", "status": "failed", "failureReason": "Incorrect billing" } }` | `400` Transition to `pending` forbidden (D19)<br>`404` Not found | **Read:** `transactions`<br>**Write:** `transactions`, `customers` (last_activity_at recalculated if moving to/from success), `audit_logs` | `transaction.status_changed` (with `actor_type: 'admin'`) | Admin Transaction Status Override Action |

#### Notifications
| Method & Path | Caller | Request Parameters & Body | Success Response | Error Cases | DB Read / Written | Audit Log Action | Frontend Service / Page |
|---|---|---|---|---|---|---|---|
| `GET /api/v1/admin/notifications` | Admin | **Query:** `page`, `limit`, `type`, `unreadOnly` (boolean) | `200 OK`<br>`{ "notifications": [ { "id": "...", "type": "worker", "title": "...", "message": "...", "isRead": false, "customerId": null, "workerId": "...", "createdAt": "..." } ], "unreadCount": 3 }` | `401` Unauthorized | **Read:** `notifications` | *None* | `adminService.getNotifications()`<br>`_admin.notifications.tsx` |
| `PATCH /api/v1/admin/notifications/:id/read` | Admin | **Path:** `id` | `200 OK`<br>`{ "notification": { "id": "...", "isRead": true, "readAt": "..." } }` | `404` Not found | **Read:** `notifications`<br>**Write:** `notifications` (is_read = true, read_at = now()) | *None* (high-noise event excluded from audit) | `admin-store.tsx`: `markRead()`<br>`_admin.notifications.tsx` |
| `POST /api/v1/admin/notifications/mark-all-read` | Admin | *None* | `200 OK`<br>`{ "message": "All notifications marked as read" }` | `401` Unauthorized | **Read:** `notifications`<br>**Write:** `notifications` (is_read = true, read_at = now()) | *None* | `admin-store.tsx`: `markAllRead()`<br>`_admin.notifications.tsx` |

#### Audit Logs View
| Method & Path | Caller | Request Parameters & Body | Success Response | Error Cases | DB Read / Written | Audit Log Action | Frontend Service / Page |
|---|---|---|---|---|---|---|---|
| `GET /api/v1/admin/audit-logs` | Admin | **Query:** `page`, `limit`, `action`, `actorType`, `actorId`, `entityType`, `entityId`, `reason`, `from`, `to` | `200 OK`<br>`{ "data": [ { "id": "...", "actorType": "worker", "actorId": "...", "actorName": "Rajesh M.", "action": "scan.rejected", "entityType": null, "entityId": null, "oldStatus": null, "newStatus": null, "reason": "CUSTOMER_INACTIVE", "ipAddress": "192.168.1.50", "createdAt": "..." } ], "pagination": { ... } }` | `400` Invalid filter | **Read:** `audit_logs` | *None* | New Audit Logs Route / Tab (including Rejected Scans) |

#### Reports & Global Search
| Method & Path | Caller | Request Parameters & Body | Success Response | Error Cases | DB Read / Written | Audit Log Action | Frontend Service / Page |
|---|---|---|---|---|---|---|---|
| `GET /api/v1/admin/reports/summary` | Admin | **Query:**<br>`category`: `'transactions' \| 'discount' \| 'customers' \| 'workers' \| 'groups'`<br>`from`: string (date)<br>`to`: string (date) | `200 OK`<br>`{ "category": "transactions", "range": { "from": "...", "to": "..." }, "metrics": [ ["Transactions", "142"], ["Revenue", "₹4,89,000"], ... ], "series": [ ... ] }` | `400` Invalid category or range | **Read:** `transactions`, `customers`, `workers`, `groups` | *None* | `_admin.reports.tsx` (Summary Cards & Chart) |
| `GET /api/v1/admin/reports/export` | Admin | **Query:**<br>`category`: `'transactions' \| 'discount' \| 'customers' \| 'workers' \| 'groups'`<br>`from`: string (date)<br>`to`: string (date)<br>`format`: `'csv' \| 'json'` (default `'csv'`) | If CSV: `200 OK`<br>`Content-Type: text/csv`<br>`Content-Disposition: attachment; filename="transactions-report.csv"`<br>Streamed CSV body.<br>If JSON: paginated records | `400` Invalid range | **Read:** `transactions`, `customers`, `workers`, `groups` | *None* | `exportCsv()` in `_admin.reports.tsx` |
| `GET /api/v1/admin/search` | Admin | **Query:**<br>`q`: string (search term, min 1 char) | `200 OK`<br>`{ "customers": [ { "id": "...", "name": "...", "phone": "...", "email": "...", "status": "active" } ], "workers": [ { "id": "...", "name": "...", "phone": "...", "email": "...", "status": "active" } ] }` | `400` Empty query | **Read:** `customers`, `workers` | *None* | `_admin.search.tsx` |

---

## 3. Business Rules per Endpoint

### 3.1 QR Scan Resolution (`POST /api/v1/worker/scan`)
1. **Worker Status Verification:** The worker making the scan must be active (`status === 'active'`). If `status === 'suspended'`, immediately reject with HTTP `403 Forbidden` (`code: "WORKER_SUSPENDED"`). Record an audit entry: `action: "scan.rejected"`, `reason: "WORKER_SUSPENDED"`.
2. **QR Token Lookup:** Locate the customer record matching `qr_token === req.body.qrToken` and `deleted_at IS NULL`.
   - If not found (or token has been superseded by customer regeneration): Reject with HTTP `404 Not Found` (`code: "CUSTOMER_NOT_FOUND"`). Record `action: "scan.rejected"`, `reason: "CUSTOMER_NOT_FOUND"`. Do NOT write the scanned token value to the audit log.
3. **Customer Inactive Check:** If customer exists but `status === 'inactive'`: Reject with HTTP `422 Unprocessable Entity` (`code: "CUSTOMER_INACTIVE"`). Record `action: "scan.rejected"`, `reason: "CUSTOMER_INACTIVE"`, `actor_id: worker.id`, `entity_id: customer.id`. No transaction row is created.
4. **Inactive Group Rule (D38):** Retrieve customer's group.
   - If `group.active === FALSE`, the effective discount is **`0.00%`**. The scan proceeds normally.
   - If `group.active === TRUE`, the effective discount is `group.discount_percent`.
5. **Success Output:** Returns `customerId`, `customerName`, `groupId`, `groupName`, and `discountPercent` for prefilling the mobile POS form.

---

### 3.2 Transaction Creation (`POST /api/v1/worker/transactions`)
1. **Idempotency Protection (D53):** If client provides `id`, execute insert with `ON CONFLICT (id) DO NOTHING`. If a row already exists, fetch and return the existing record with `200 OK`.
2. **Pricing Snapshots (D18, D38):**
   - `amount` is price before discount (must be $> 0$).
   - `discount_percent` is captured as snapshot at scan time (effective 0% if group is inactive).
   - `discount_amount` is calculated as `ROUND(amount * discount_percent / 100, 2)`.
   - Customer pays `amount - discount_amount`.
3. **Status Initialization:** Row is created with `status = 'pending'`, `submitted_at = now()`, `resolved_at = NULL`.
4. **Worker Activity Update (D41):** `workers.last_activity_at` is set to `now()` (tracks any submitted transaction).
5. **Audit Logging:** An audit log entry `transaction.created` is committed in the **same transaction**.

---

### 3.3 Transaction Status Changes (`PATCH /api/v1/worker/transactions/:id/status` & `/api/v1/admin/transactions/:id/status`)
1. **Allowed Transitions (D19):**
   - `pending` $\rightarrow$ `success`
   - `pending` $\rightarrow$ `failed`
   - `success` $\rightarrow$ `failed`
   - `failed` $\rightarrow$ `success`
   - Reverting to `pending` (`*` $\rightarrow$ `pending`) is strictly **forbidden**; rejected with `400 Bad Request` (`code: "CANNOT_REVERT_TO_PENDING"`).
2. **Resolved Timestamp:** On the transition away from `pending`, set `resolved_at = now()` (set once; never overwritten on subsequent transitions).
3. **Customer Activity Recalculation (D40):**
   - If transitioning to `success` or moving from `success` $\rightarrow$ `failed`, atomically recalculate `customers.last_activity_at`:
     ```sql
     UPDATE customers
     SET last_activity_at = (
       SELECT MAX(submitted_at) FROM transactions
       WHERE customer_id = customers.id AND status = 'success'
     )
     WHERE id = $1;
     ```
4. **Worker Activity:** `workers.last_activity_at` is **not** affected by status transitions.
5. **Audit Trail (D37):** Every transition logs `action: "transaction.status_changed"` with `actor_type: 'worker'` or `'admin'`, capturing `old_status`, `new_status`, and `failure_reason` in the same database transaction.

---

### 3.4 Worker First Login Notification (D36, D51)
1. On successful verification of a worker login OTP:
   - Check if `workers.first_login_at IS NULL`.
   - If NULL: Atomically set `first_login_at = now()`.
   - Create a row in `notifications`:
     - `type = 'worker'`
     - `title = 'Worker First Login'`
     - `message = 'Worker <Name> has logged in for the first time.'`
     - `worker_id = <worker.id>`
     - `is_read = FALSE`
2. Subsequent logins by that worker do not trigger duplicate notifications.

---

### 3.5 Customer Registration Notification (D36)
1. On successful self-registration (`POST /api/v1/customer/register`):
   - Create a row in `notifications`:
     - `type = 'registration'`
     - `title = 'New Customer Registered'`
     - `message = 'Customer <Name> registered via mobile app.'`
     - `customer_id = <customer.id>`
     - `is_read = FALSE`

---

### 3.6 Default Group Protections (D42)
1. `DELETE /api/v1/admin/groups/:id`: Rejected with `400 Bad Request` (`code: "CANNOT_DELETE_DEFAULT_GROUP"`) if `is_default === TRUE`.
2. `PATCH /api/v1/admin/groups/:id/toggle-active`: Rejected with `400 Bad Request` (`code: "CANNOT_DEACTIVATE_DEFAULT_GROUP"`) if `is_default === TRUE`.
3. When any custom group is deleted, all members currently in that group are reassigned to `DEFAULT_GROUP_ID` in the same database transaction before setting `deleted_at = now()`.

---

## 4. Mapping `adminService.ts` to API Endpoints

The existing frontend uses functions in `frontend/src/services/adminService.ts` that query in-memory mock data. The table below maps every frontend function to its backend endpoint:

| `adminService.ts` / Store Function | Existing Mock Behavior | Target Backend API Endpoint |
|---|---|---|
| `adminService.getProfile()` | Returns static `adminProfile` object | `GET /api/v1/admin/profile` |
| `adminService.getCustomers()` | Returns array of mock customers | `GET /api/v1/admin/customers` |
| `adminService.getWorkers()` | Returns array of mock workers | `GET /api/v1/admin/workers` |
| `adminService.getGroups()` | Returns array of mock groups | `GET /api/v1/admin/groups` |
| `adminService.getTransactions()` | Returns array of mock transactions | `GET /api/v1/admin/transactions` |
| `adminService.getNotifications()` | Returns array of mock notifications | `GET /api/v1/admin/notifications` |
| `adminService.buildOverview(...)` | Computes KPI counts & sums client-side | `GET /api/v1/admin/dashboard/overview` |
| `adminService.buildSeries(...)` | Groups transactions into date buckets client-side | `GET /api/v1/admin/dashboard/series?days=...` |
| `adminService.groupDistribution(...)` | Aggregates customers/discounts by group | `GET /api/v1/admin/dashboard/group-distribution` |
| `adminService.workerActivity(...)` | Sorts and maps scans/transactions by worker | `GET /api/v1/admin/dashboard/worker-activity` |
| `adminService.exportCsv(...)` | Assembles CSV string in browser from in-memory arrays | `GET /api/v1/admin/reports/export?category=...&from=...&to=...&format=csv` (or client-side from paginated JSON) |
| `store.login(email)` | Sets `sessionStorage` flag | `POST /api/v1/auth/admin/login` |
| `store.logout()` | Clears `sessionStorage` | `POST /api/v1/auth/logout` |
| `store.updateProfile(patch)` | Updates in-memory state | `PATCH /api/v1/admin/profile` |
| `store.saveCustomer(customer)` | Inserts or updates customer in state | `POST /api/v1/admin/customers` (create) or `PATCH /api/v1/admin/customers/:id` (edit) |
| `store.deleteCustomer(id)` | Filters out of state array | `DELETE /api/v1/admin/customers/:id` |
| `store.assignCustomerGroup(cId, gId)` | Modifies customer groupId in state | `PATCH /api/v1/admin/customers/:id/group` |
| `store.saveWorker(worker)` | Inserts or updates worker in state | `POST /api/v1/admin/workers` (create) or `PATCH /api/v1/admin/workers/:id` (edit) |
| `store.deleteWorker(id)` | Filters out of state array | `DELETE /api/v1/admin/workers/:id` |
| `store.saveGroup(group)` | Inserts or updates group in state | `POST /api/v1/admin/groups` (create) or `PATCH /api/v1/admin/groups/:id` (edit) |
| `store.deleteGroup(id)` | Deletes and resets members to default | `DELETE /api/v1/admin/groups/:id` |
| `store.toggleGroupActive(id)` | Inverts active boolean in state | `PATCH /api/v1/admin/groups/:id/toggle-active` |
| `store.markRead(id)` | Flips read boolean in state | `PATCH /api/v1/admin/notifications/:id/read` |
| `store.markAllRead()` | Flips all read booleans in state | `POST /api/v1/admin/notifications/mark-all-read` |

---

## 5. Required Frontend Changes (Inventory)

The following changes will be required in the frontend code when connecting to the real API (documentation only; no code is written in this task):

1. **Authentication Store & Token Interceptor (`admin-store.tsx`):**
   - Replace `sessionStorage` mock flag with JWT session handling.
   - Attach `Authorization: Bearer <accessToken>` header on outgoing HTTP requests.
   - Implement automatic refresh token interceptor upon HTTP 401 response.
2. **Service Layer Swap (`adminService.ts`):**
   - Replace mock data returns with `fetch` / `axios` API calls targeting `/api/v1`.
3. **Password Fields Removal:**
   - Remove `password` and `confirmPassword` inputs from Create/Edit Customer dialog (`_admin.customers.tsx`).
   - Remove `password` and `confirmPassword` inputs from Create/Edit Worker dialog (`_admin.workers.tsx`).
4. **Remove Pending Customer Status:**
   - Remove `'pending'` option from customer status dropdowns and badges (Schema v5 limits to `active` and `inactive`).
5. **Phone Number Auto-Format:**
   - Add UI normalization so bare 10-digit phone inputs automatically prepend `+91`.
6. **Transaction Status Column & Detail:**
   - Add `status` badge column (`pending` / `success` / `failed`) in reports and detail tables.
   - Add a control in transaction detail dialog allowing admins to change transaction status (`success` $\leftrightarrow$ `failed`) and view/edit `failureReason`.
7. **Handle Null Litres & Fuel Types:**
   - Safely display `"—"` when `litres` or `fuel_type` are null.
8. **Notification UI Updates:**
   - Filter tabs in `_admin.notifications.tsx` updated to support `worker` and `registration` types.
   - "Open Worker" button linked to `workerId`.
9. **Audit Logs View:**
   - Implement new route / page for Audit Logs (filter by action, actor, entity, date range, and view rejected scans with reason codes).

---

## 6. Possible Additional Mobile Endpoints (Unconfirmed by Owner)

The owner has specified the core mobile flows (registration, login, QR generation/regeneration for customers; scan resolution, submit transaction, mark success/failed for workers). The following additional mobile endpoints are typical but **unconfirmed**:

1. **Customer Transaction History (`GET /api/v1/customer/transactions`):** Allows customers to view their past fuel purchases, discounts received, and savings. *(Unconfirmed)*
2. **Customer Profile Management (`GET /api/v1/customer/profile`, `PATCH /api/v1/customer/profile`):** Allows customers to update their name, email, or vehicle description from the mobile app. *(Unconfirmed)*
3. **Worker Transaction & Shift History (`GET /api/v1/worker/transactions`):** Allows attendants to view scans completed during their current shift. *(Unconfirmed)*
4. **Worker Shift Status (`GET /api/v1/worker/profile`):** Allows workers to view their assigned shift (Morning/Evening/Night) and personal profile. *(Unconfirmed)*

---

## 7. Open Questions for the Owner

1. **CSV Export Generation:** Should CSV exports in reports be generated **server-side** as streamed downloads (`GET /api/v1/admin/reports/export?format=csv`), or should the server return JSON and let the browser construct the CSV client-side (as the mock currently does)?  
   *(Recommendation: Server-side streaming endpoint ensures complete export even when dataset exceeds client page limits).*
2. **Admin Session Strategy:** Confirm preference between:
   - *Option A (Recommended):* Access token in `Authorization` header, refresh token in `httpOnly` secure cookie.
   - *Option B:* Both access and refresh tokens handled via Bearer headers and stored in browser memory/sessionStorage.
3. **Notification Retention & Cleanup:** Should notifications older than 30 or 90 days be automatically pruned by the cleanup job, or retained indefinitely?
4. **Additional Mobile Endpoints:** Confirm whether Customer Transaction History or Worker Shift Summary endpoints are required for initial mobile release (see §6).

---

*End of API proposal. Awaiting orchestrator instructions.*
