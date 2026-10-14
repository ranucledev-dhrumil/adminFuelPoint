import { Decimal } from "decimal.js";
import { pool } from "../../db/pool.js";
import { withTransaction } from "../../db/transaction.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
} from "../../common/errors/app-error.js";
import type { AuthActor } from "../../common/types/common.js";
import {
  signScanTicket,
  verifyScanTicket,
  type ScanTicketPayload,
} from "../../common/utils/crypto.js";
import { parseDateBoundary } from "../../common/utils/date.js";
import { auditService } from "../audit/audit.service.js";
import {
  transactionRepository,
  type FuelType,
  type TransactionRow,
  type TransactionStatus,
} from "./transaction.repository.js";

// Set precision and rounding mode to match PostgreSQL ROUND(..., 2) (half-up)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface ScanResult {
  customerId: string;
  customerName: string;
  groupId: string;
  groupName: string;
  discountPercent: string;
  scanTicket: string;
}

export interface CreateTransactionDTO {
  id: string;
  scanTicket: string;
  amount: string;
  litres?: string | null;
  fuelType?: FuelType | null;
}

export interface UpdateTransactionStatusDTO {
  status: "success" | "failed";
  failureReason?: string | null;
}

export interface TransactionResponse {
  id: string;
  status: TransactionStatus;
  amount: string;
  discountPercent: string;
  discountAmount: string;
  netPayable: string;
  fuel?: FuelType;
  litres?: string;
  failureReason?: string | null;
  submittedAt: string;
  resolvedAt: string | null;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  workerId?: string;
  workerName?: string;
  groupId?: string;
  groupName?: string;
  createdAt?: string;
  updatedAt?: string;
}

function mapTransaction(row: TransactionRow): TransactionResponse {
  const amt = new Decimal(row.amount);
  const disc = new Decimal(row.discount_amount);
  const net = amt.minus(disc);

  return {
    id: row.id,
    status: row.status,
    amount: amt.toFixed(2),
    discountPercent: new Decimal(row.discount_percent).toFixed(2),
    discountAmount: disc.toFixed(2),
    netPayable: net.toFixed(2),
    fuel: row.fuel_type ?? undefined,
    litres: row.litres ? new Decimal(row.litres).toFixed(2) : undefined,
    failureReason: row.failure_reason,
    submittedAt: row.submitted_at.toISOString(),
    resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    workerId: row.worker_id,
    workerName: row.worker_name,
    groupId: row.group_id,
    groupName: row.group_name,
    createdAt: row.submitted_at ? row.submitted_at.toISOString() : undefined,
    updatedAt: row.updated_at ? row.updated_at.toISOString() : undefined,
  };
}

export class TransactionService {
  /**
   * Resolves a customer loyalty QR token for a pump attendant.
   * Rejection writes an audit_logs row in a standalone transaction and never logs the scanned token.
   */
  async scanQr(
    actor: AuthActor,
    qrToken: string,
    ip?: string,
    userAgent?: string,
  ): Promise<ScanResult> {
    const worker = await transactionRepository.findWorkerById(actor.sub);
    const workerName = worker?.name || "Attendant";

    const customer = await transactionRepository.findCustomerByQrToken(qrToken);

    // 1. Unknown token or superseded token
    if (!customer) {
      await auditService.recordStandalone({
        action: "scan.rejected",
        actorType: "worker",
        actorId: actor.sub,
        actorName: workerName,
        reason: "CUSTOMER_NOT_FOUND",
        ipAddress: ip,
        userAgent,
      });

      throw new NotFoundError(
        "No customer found matching the scanned QR code.",
        "CUSTOMER_NOT_FOUND",
      );
    }

    // 2. Inactive customer check
    if (customer.status !== "active") {
      await auditService.recordStandalone({
        action: "scan.rejected",
        actorType: "worker",
        actorId: actor.sub,
        actorName: workerName,
        entityType: "customer",
        entityId: customer.id,
        reason: "CUSTOMER_INACTIVE",
        ipAddress: ip,
        userAgent,
      });

      throw new UnprocessableEntityError("Customer account is inactive.", "CUSTOMER_INACTIVE");
    }

    // 3. Inactive Group Rule (D38)
    // If group.active === false, effective discount is 0.00%
    const effectiveDiscount = customer.group_active
      ? new Decimal(customer.discount_percent).toFixed(2)
      : "0.00";

    // 4. Generate signed, short-lived scan ticket
    const ticketPayload: ScanTicketPayload = {
      customerId: customer.id,
      groupId: customer.group_id,
      discountPercent: effectiveDiscount,
    };
    const scanTicket = signScanTicket(ticketPayload);

    return {
      customerId: customer.id,
      customerName: customer.name,
      groupId: customer.group_id,
      groupName: customer.group_name,
      discountPercent: effectiveDiscount,
      scanTicket,
    };
  }

  /**
   * Submits a transaction from the worker mobile app.
   * Handles idempotency (same worker, identical payload) and concurrency collisions.
   */
  async createTransaction(
    actor: AuthActor,
    dto: CreateTransactionDTO,
    ip?: string,
    userAgent?: string,
  ): Promise<{ transaction: TransactionResponse; isRetry: boolean }> {
    // 1. Validate scan ticket
    let ticketPayload: ScanTicketPayload;
    try {
      ticketPayload = verifyScanTicket(dto.scanTicket);
    } catch {
      throw new BadRequestError(
        "Scan ticket has expired or is invalid. Please scan QR again.",
        "EXPIRED_SCAN_TICKET",
      );
    }

    // 2. Validate amount (> 0)
    let decAmount: Decimal;
    try {
      decAmount = new Decimal(dto.amount);
      if (decAmount.isNaN() || decAmount.lessThanOrEqualTo(0)) {
        throw new Error();
      }
    } catch {
      throw new BadRequestError("Amount must be greater than 0.", "INVALID_AMOUNT");
    }

    // 3. Validate litres if present (> 0)
    let litresFormatted: string | null = null;
    if (dto.litres !== undefined && dto.litres !== null && String(dto.litres).trim() !== "") {
      try {
        const decLitres = new Decimal(dto.litres);
        if (decLitres.isNaN() || decLitres.lessThanOrEqualTo(0)) {
          throw new Error();
        }
        litresFormatted = decLitres.toFixed(2);
      } catch {
        throw new BadRequestError("Litres must be greater than 0.", "INVALID_LITRES");
      }
    }

    // 4. Calculate discount with Decimal.js matching PostgreSQL ROUND
    const decPercent = new Decimal(ticketPayload.discountPercent);
    const decDiscount = decAmount
      .times(decPercent)
      .dividedBy(100)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const amountStr = decAmount.toFixed(2);
    const discountPercentStr = decPercent.toFixed(2);
    const discountAmountStr = decDiscount.toFixed(2);
    const fuelTypeVal = dto.fuelType || null;

    // Helper to evaluate idempotency against an existing row
    const checkIdempotency = (
      existing: TransactionRow,
    ): { transaction: TransactionResponse; isRetry: boolean } => {
      const isSameWorker = existing.worker_id === actor.sub;
      const isSameCustomer = existing.customer_id === ticketPayload.customerId;
      const isSameAmount = new Decimal(existing.amount).toFixed(2) === amountStr;
      const isSameLitres =
        (existing.litres ? new Decimal(existing.litres).toFixed(2) : null) === litresFormatted;
      const isSameFuel = (existing.fuel_type || null) === fuelTypeVal;

      if (isSameWorker && isSameCustomer && isSameAmount && isSameLitres && isSameFuel) {
        return { transaction: mapTransaction(existing), isRetry: true };
      }

      throw new ConflictError(
        "Transaction with this ID already exists with different parameters.",
        "IDEMPOTENCY_CONFLICT",
      );
    };

    // 5. Check if transaction already exists (pre-check)
    const existing = await transactionRepository.findById(dto.id);
    if (existing) {
      return checkIdempotency(existing);
    }

    const worker = await transactionRepository.findWorkerById(actor.sub);
    const workerName = worker?.name || "Attendant";

    // 6. Insert transaction in database transaction
    try {
      const createdRow = await withTransaction(pool, async (client) => {
        const row = await transactionRepository.create(
          {
            id: dto.id,
            customerId: ticketPayload.customerId,
            workerId: actor.sub,
            groupId: ticketPayload.groupId,
            amount: amountStr,
            discountPercent: discountPercentStr,
            discountAmount: discountAmountStr,
            litres: litresFormatted,
            fuelType: fuelTypeVal,
          },
          client,
        );

        // Maintain workers.last_activity_at on each submission
        await transactionRepository.updateWorkerLastActivity(actor.sub, client);

        // Record audit log transaction.created in the same transaction
        await auditService.recordInTx(
          {
            action: "transaction.created",
            actorType: "worker",
            actorId: actor.sub,
            actorName: workerName,
            entityType: "transaction",
            entityId: row.id,
            newValue: {
              customer_id: ticketPayload.customerId,
              amount: amountStr,
              discount_percent: discountPercentStr,
              discount_amount: discountAmountStr,
              litres: litresFormatted,
              fuel_type: fuelTypeVal,
            },
            ipAddress: ip,
            userAgent,
          },
          client,
        );

        return row;
      });

      return { transaction: mapTransaction(createdRow), isRetry: false };
    } catch (err: unknown) {
      // Concurrency check: if another request inserted this ID concurrently, re-read and verify idempotency
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "23505"
      ) {
        const retryExisting = await transactionRepository.findById(dto.id);
        if (retryExisting) {
          return checkIdempotency(retryExisting);
        }
      }
      throw err;
    }
  }

  /**
   * Updates transaction status (pending -> success/failed, success <-> failed).
   * Workers can only update their own transactions; admins can update any.
   * Reverting to pending is strictly prohibited.
   */
  async updateStatus(
    actor: AuthActor,
    transactionId: string,
    dto: UpdateTransactionStatusDTO,
    ip?: string,
    userAgent?: string,
  ): Promise<TransactionResponse> {
    const targetStatus = dto.status;
    if (targetStatus !== "success" && targetStatus !== "failed") {
      throw new BadRequestError("Invalid status value", "INVALID_STATUS");
    }

    // Resolve actor name
    let actorName = "Admin";
    if (actor.role === "worker") {
      const worker = await transactionRepository.findWorkerById(actor.sub);
      actorName = worker?.name || "Attendant";
    } else if (actor.role === "admin") {
      const admin = await transactionRepository.findAdminById(actor.sub);
      actorName = admin?.name || "Administrator";
    }

    return withTransaction(pool, async (client) => {
      const tx = await transactionRepository.lockForUpdate(transactionId, client);
      if (!tx) {
        throw new NotFoundError("Transaction not found", "TRANSACTION_NOT_FOUND");
      }

      // Worker ownership constraint
      if (actor.role === "worker" && tx.worker_id !== actor.sub) {
        throw new ForbiddenError(
          "You can only update transactions created by yourself.",
          "NOT_OWN_TRANSACTION",
        );
      }

      // Check transition rules
      const oldStatus = tx.status;
      if (
        targetStatus === oldStatus &&
        (tx.failure_reason || null) === (dto.failureReason || null)
      ) {
        // No-op
        const fullTx = await transactionRepository.findById(transactionId, client);
        return mapTransaction(fullTx || tx);
      }

      // Reverting to pending is strictly forbidden (D19)
      if ((targetStatus as string) === "pending") {
        throw new BadRequestError("Reverting to pending is forbidden.", "CANNOT_REVERT_TO_PENDING");
      }

      // Resolved timestamp: set on initial transition away from pending, otherwise keep existing
      const resolvedAt = oldStatus === "pending" ? new Date() : tx.resolved_at;
      const failureReason = targetStatus === "failed" ? dto.failureReason || null : null;

      const updatedRow = await transactionRepository.updateStatus(
        transactionId,
        targetStatus,
        failureReason,
        resolvedAt,
        client,
      );

      // Recalculate customer last_activity_at when moving to or from success
      if (targetStatus === "success" || oldStatus === "success") {
        await transactionRepository.recalculateCustomerLastActivity(tx.customer_id, client);
      }

      // Record audit log transaction.status_changed in same database transaction
      await auditService.recordInTx(
        {
          action: "transaction.status_changed",
          actorType: actor.role === "admin" ? "admin" : "worker",
          actorId: actor.sub,
          actorName,
          entityType: "transaction",
          entityId: tx.id,
          oldStatus,
          newStatus: targetStatus,
          reason: failureReason || undefined,
          newValue: {
            resolved_at: resolvedAt ? resolvedAt.toISOString() : null,
            failure_reason: failureReason,
          },
          ipAddress: ip,
          userAgent,
        },
        client,
      );

      const fullTx = await transactionRepository.findById(transactionId, client);
      return mapTransaction(fullTx || updatedRow);
    });
  }

  /**
   * Retrieves transactions for admin panel with server-side pagination and filters.
   */
  async listAdminTransactions(query: {
    page?: number;
    limit?: number;
    sort_by?: "submitted_at" | "amount" | "discount_amount" | "status";
    order?: "asc" | "desc" | "ASC" | "DESC";
    status?: TransactionStatus;
    customerId?: string;
    workerId?: string;
    groupId?: string;
    from?: string;
    to?: string;
    q?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const sort_by = query.sort_by || "submitted_at";
    const order = (query.order || "desc").toLowerCase() as "asc" | "desc";

    const fromDate = query.from ? parseDateBoundary(query.from, "start") : undefined;
    const toDate = query.to ? parseDateBoundary(query.to, "end") : undefined;

    const { rows, total } = await transactionRepository.listAdminTransactions({
      page,
      limit,
      sort_by,
      order,
      status: query.status,
      customerId: query.customerId,
      workerId: query.workerId,
      groupId: query.groupId,
      from: fromDate,
      to: toDate,
      q: query.q?.trim() || undefined,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: rows.map(mapTransaction),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Retrieves single transaction detail for admin with audit log status history.
   */
  async getAdminTransactionDetail(id: string) {
    const tx = await transactionRepository.findById(id);
    if (!tx) {
      throw new NotFoundError("Transaction not found", "TRANSACTION_NOT_FOUND");
    }

    const history = await transactionRepository.getStatusHistory(id);

    return {
      transaction: mapTransaction(tx),
      statusHistory: history.map((h) => ({
        id: h.id,
        oldStatus: h.old_status,
        newStatus: h.new_status,
        actorType: h.actor_type,
        actorId: h.actor_id,
        actorName: h.actor_name,
        reason: h.reason,
        createdAt: h.created_at.toISOString(),
      })),
    };
  }

  /**
   * Retrieves transaction history for the authenticated worker.
   */
  async listWorkerTransactions(
    workerId: string,
    query: {
      page?: number;
      limit?: number;
      status?: TransactionStatus;
      from?: string;
      to?: string;
      sort_by?: "submitted_at" | "amount" | "discount_amount" | "status";
      order?: "asc" | "desc" | "ASC" | "DESC";
    },
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const sort_by = query.sort_by || "submitted_at";
    const order = (query.order || "desc").toLowerCase() as "asc" | "desc";

    const fromDate = query.from ? parseDateBoundary(query.from, "start") : undefined;
    const toDate = query.to ? parseDateBoundary(query.to, "end") : undefined;

    const { rows, total } = await transactionRepository.listWorkerTransactions(workerId, {
      page,
      limit,
      sort_by,
      order,
      status: query.status,
      from: fromDate,
      to: toDate,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: rows.map(mapTransaction),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Retrieves transaction history for the authenticated customer.
   */
  async listCustomerTransactions(
    customerId: string,
    query: {
      page?: number;
      limit?: number;
      sort_by?: "submitted_at" | "amount" | "discount_amount" | "status";
      order?: "asc" | "desc" | "ASC" | "DESC";
    },
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const sort_by = query.sort_by || "submitted_at";
    const order = (query.order || "desc").toLowerCase() as "asc" | "desc";

    const { rows, total } = await transactionRepository.listCustomerTransactions(customerId, {
      page,
      limit,
      sort_by,
      order,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: rows.map(mapTransaction),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }
}

export const transactionService = new TransactionService();
