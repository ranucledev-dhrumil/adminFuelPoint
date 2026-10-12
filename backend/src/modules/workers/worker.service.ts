import { pool } from "../../db/pool.js";
import { withTransaction } from "../../db/transaction.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../common/errors/app-error.js";
import type { AuthActor } from "../../common/types/common.js";
import { normalizeIndianPhone } from "../../common/utils/phone.js";
import { normalizeEmail } from "../../common/utils/email.js";
import { auditService } from "../audit/audit.service.js";
import { adminRepository } from "../admin-users/admin.repository.js";
import {
  workerRepository,
  type WorkerListItemRow,
  type WorkerTransactionRow,
  type ListWorkersParams,
  type WorkerShift,
  type WorkerStatus,
} from "./worker.repository.js";

export interface WorkerListItemResponse {
  id: string;
  name: string;
  email: string;
  phone: string;
  shift: WorkerShift;
  status: WorkerStatus;
  joinedAt: string;
  firstLoginAt: string | null;
  scans: number;
  transactions: number;
  customersScanned: number;
  discountProcessed: string;
  lastActivity: string | null;
}

export interface WorkerDetailResponse {
  worker: WorkerListItemResponse & {
    createdAt: string;
    updatedAt: string;
  };
  recentTransactions: {
    id: string;
    status: string;
    amount: string;
    discountPercent: string;
    discountAmount: string;
    netPayable: string;
    fuel?: string;
    litres?: string;
    submittedAt: string;
    resolvedAt: string | null;
    customerId: string;
    customerName: string | null;
  }[];
}

export interface CreateWorkerDTO {
  name: string;
  email: string;
  phone: string;
  shift: WorkerShift;
  status?: WorkerStatus;
}

export interface UpdateWorkerDTO {
  name?: string;
  email?: string;
  phone?: string;
  shift?: WorkerShift;
}

function mapWorkerListItem(row: WorkerListItemRow): WorkerListItemResponse {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    shift: row.shift,
    status: row.status,
    joinedAt: row.joined_at.toISOString(),
    firstLoginAt: row.first_login_at ? row.first_login_at.toISOString() : null,
    scans: Number(row.scans ?? 0),
    transactions: Number(row.transactions ?? 0),
    customersScanned: Number(row.customers_scanned ?? 0),
    discountProcessed: Number(row.discount_processed ?? 0).toFixed(2),
    lastActivity: row.last_activity_at ? row.last_activity_at.toISOString() : null,
  };
}

function mapWorkerTransaction(t: WorkerTransactionRow) {
  return {
    id: t.id,
    status: t.status,
    amount: Number(t.amount).toFixed(2),
    discountPercent: Number(t.discount_percent).toFixed(2),
    discountAmount: Number(t.discount_amount).toFixed(2),
    netPayable: Number(t.net_payable).toFixed(2),
    fuel: t.fuel_type ?? undefined,
    litres: t.litres ? Number(t.litres).toFixed(2) : undefined,
    submittedAt: t.submitted_at.toISOString(),
    resolvedAt: t.resolved_at ? t.resolved_at.toISOString() : null,
    customerId: t.customer_id,
    customerName: t.customer_name ?? null,
  };
}

export class WorkerService {
  private async getAdminName(adminId: string): Promise<string> {
    const admin = await adminRepository.findById(adminId);
    return admin?.name ?? "Super Admin";
  }

  async listWorkers(params: ListWorkersParams) {
    const { rows, total } = await workerRepository.list(params);
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(100, params.limit ?? 20));
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: rows.map(mapWorkerListItem),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async getWorkerDetail(id: string): Promise<WorkerDetailResponse> {
    const worker = await workerRepository.findById(id);
    if (!worker) {
      throw new NotFoundError("Worker not found", "WORKER_NOT_FOUND");
    }

    const recent = await workerRepository.getRecentTransactions(id, 10);

    return {
      worker: {
        ...mapWorkerListItem(worker),
        createdAt: worker.created_at.toISOString(),
        updatedAt: worker.updated_at.toISOString(),
      },
      recentTransactions: recent.map(mapWorkerTransaction),
    };
  }

  async createWorker(
    actor: AuthActor,
    dto: CreateWorkerDTO,
    ip?: string,
    userAgent?: string,
  ): Promise<{ worker: WorkerListItemResponse }> {
    const normalizedPhone = normalizeIndianPhone(dto.phone);
    if (!normalizedPhone) {
      throw new BadRequestError("Invalid Indian phone number format.", "INVALID_PHONE");
    }

    const normalizedEmail = normalizeEmail(dto.email);
    if (!normalizedEmail) {
      throw new BadRequestError("Invalid email address format.", "INVALID_EMAIL");
    }

    // Check phone uniqueness
    const existingPhone = await workerRepository.findByPhone(normalizedPhone);
    if (existingPhone) {
      throw new ConflictError(
        "Phone number is already registered for another worker.",
        "PHONE_ALREADY_EXISTS",
      );
    }

    // Check email uniqueness
    const existingEmail = await workerRepository.findByEmail(normalizedEmail);
    if (existingEmail) {
      throw new ConflictError(
        "Email address is already registered for another worker.",
        "EMAIL_ALREADY_EXISTS",
      );
    }

    const actorName = await this.getAdminName(actor.sub);

    const created = await withTransaction(pool, async (client) => {
      const dupPhone = await workerRepository.findByPhone(normalizedPhone, undefined, client);
      if (dupPhone) {
        throw new ConflictError(
          "Phone number is already registered for another worker.",
          "PHONE_ALREADY_EXISTS",
        );
      }
      const dupEmail = await workerRepository.findByEmail(normalizedEmail, undefined, client);
      if (dupEmail) {
        throw new ConflictError(
          "Email address is already registered for another worker.",
          "EMAIL_ALREADY_EXISTS",
        );
      }

      const row = await workerRepository.create(
        {
          name: dto.name,
          phone: normalizedPhone,
          email: normalizedEmail,
          shift: dto.shift,
          status: dto.status ?? "active",
        },
        client,
      );

      // Audit log worker.created committed in same transaction
      await auditService.recordInTx(
        {
          actorType: "admin",
          actorId: actor.sub,
          actorName,
          action: "worker.created",
          entityType: "worker",
          entityId: row.id,
          newValue: {
            name: row.name,
            phone: row.phone,
            email: row.email,
            shift: row.shift,
            status: row.status,
          },
          ipAddress: ip,
          userAgent,
        },
        client,
      );

      return row;
    });

    const item: WorkerListItemResponse = {
      id: created.id,
      name: created.name,
      email: created.email,
      phone: created.phone,
      shift: created.shift,
      status: created.status,
      joinedAt: created.joined_at.toISOString(),
      firstLoginAt: null,
      scans: 0,
      transactions: 0,
      customersScanned: 0,
      discountProcessed: "0.00",
      lastActivity: null,
    };

    return { worker: item };
  }

  async updateWorker(
    actor: AuthActor,
    id: string,
    dto: UpdateWorkerDTO,
    ip?: string,
    userAgent?: string,
  ): Promise<{ worker: WorkerListItemResponse }> {
    let normalizedPhone: string | undefined = undefined;
    if (dto.phone !== undefined) {
      const norm = normalizeIndianPhone(dto.phone);
      if (!norm) {
        throw new BadRequestError("Invalid Indian phone number format.", "INVALID_PHONE");
      }
      normalizedPhone = norm;
    }

    let normalizedEmail: string | undefined = undefined;
    if (dto.email !== undefined) {
      const norm = normalizeEmail(dto.email);
      if (!norm) {
        throw new BadRequestError("Invalid email address format.", "INVALID_EMAIL");
      }
      normalizedEmail = norm;
    }

    const actorName = await this.getAdminName(actor.sub);

    const updated = await withTransaction(pool, async (client) => {
      const current = await workerRepository.findByIdForUpdate(id, client);
      if (!current) {
        throw new NotFoundError("Worker not found", "WORKER_NOT_FOUND");
      }

      if (normalizedPhone && normalizedPhone !== current.phone) {
        const dupPhone = await workerRepository.findByPhone(normalizedPhone, id, client);
        if (dupPhone) {
          throw new ConflictError(
            "Phone number is already registered for another worker.",
            "PHONE_ALREADY_EXISTS",
          );
        }
      }

      if (normalizedEmail && normalizedEmail !== current.email) {
        const dupEmail = await workerRepository.findByEmail(normalizedEmail, id, client);
        if (dupEmail) {
          throw new ConflictError(
            "Email address is already registered for another worker.",
            "EMAIL_ALREADY_EXISTS",
          );
        }
      }

      const row = await workerRepository.update(
        id,
        {
          name: dto.name,
          phone: normalizedPhone,
          email: normalizedEmail,
          shift: dto.shift,
        },
        client,
      );

      // Audit diff
      const oldValue: Record<string, unknown> = {};
      const newValue: Record<string, unknown> = {};

      if (dto.name !== undefined && dto.name.trim() !== current.name) {
        oldValue.name = current.name;
        newValue.name = row.name;
      }
      if (normalizedPhone !== undefined && normalizedPhone !== current.phone) {
        oldValue.phone = current.phone;
        newValue.phone = row.phone;
      }
      if (normalizedEmail !== undefined && normalizedEmail !== current.email) {
        oldValue.email = current.email;
        newValue.email = row.email;
      }
      if (dto.shift !== undefined && dto.shift !== current.shift) {
        oldValue.shift = current.shift;
        newValue.shift = row.shift;
      }

      if (Object.keys(newValue).length > 0) {
        await auditService.recordInTx(
          {
            actorType: "admin",
            actorId: actor.sub,
            actorName,
            action: "worker.updated",
            entityType: "worker",
            entityId: id,
            oldValue,
            newValue,
            ipAddress: ip,
            userAgent,
          },
          client,
        );
      }

      return row;
    });

    const full = await workerRepository.findById(updated.id);
    return { worker: mapWorkerListItem(full!) };
  }

  async updateStatus(
    actor: AuthActor,
    id: string,
    status: WorkerStatus,
    ip?: string,
    userAgent?: string,
  ): Promise<{ worker: { id: string; status: WorkerStatus } }> {
    const actorName = await this.getAdminName(actor.sub);

    const updated = await withTransaction(pool, async (client) => {
      const current = await workerRepository.findByIdForUpdate(id, client);
      if (!current) {
        throw new NotFoundError("Worker not found", "WORKER_NOT_FOUND");
      }

      const row = await workerRepository.updateStatus(id, status, client);

      // Token revocation rule:
      // Suspending revokes active tokens; offline does NOT revoke tokens (per-request status check blocks).
      if (status === "suspended") {
        await workerRepository.revokeRefreshTokens(id, client);
      }

      await auditService.recordInTx(
        {
          actorType: "admin",
          actorId: actor.sub,
          actorName,
          action: "worker.status_changed",
          entityType: "worker",
          entityId: id,
          oldStatus: current.status,
          newStatus: status,
          ipAddress: ip,
          userAgent,
        },
        client,
      );

      return row;
    });

    return { worker: { id: updated.id, status: updated.status } };
  }

  async deleteWorker(
    actor: AuthActor,
    id: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const actorName = await this.getAdminName(actor.sub);

    await withTransaction(pool, async (client) => {
      const current = await workerRepository.findByIdForUpdate(id, client);
      if (!current) {
        throw new NotFoundError("Worker not found", "WORKER_NOT_FOUND");
      }

      await workerRepository.softDelete(id, client);
      // Soft-deleting revokes active refresh tokens
      await workerRepository.revokeRefreshTokens(id, client);

      await auditService.recordInTx(
        {
          actorType: "admin",
          actorId: actor.sub,
          actorName,
          action: "worker.deleted",
          entityType: "worker",
          entityId: id,
          newValue: {
            name: current.name,
            phone: current.phone,
          },
          ipAddress: ip,
          userAgent,
        },
        client,
      );
    });

    return { message: "Worker deleted successfully" };
  }
}

export const workerService = new WorkerService();
