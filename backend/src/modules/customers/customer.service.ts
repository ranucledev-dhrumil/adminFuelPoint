import { pool } from "../../db/pool.js";
import { withTransaction } from "../../db/transaction.js";
import {
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
} from "../../common/errors/app-error.js";
import type { AuthActor } from "../../common/types/common.js";
import { normalizeIndianPhone } from "../../common/utils/phone.js";
import { normalizeEmail } from "../../common/utils/email.js";
import { generateQrToken } from "../../common/utils/crypto.js";
import { auditService } from "../audit/audit.service.js";
import { adminRepository } from "../admin-users/admin.repository.js";
import { groupRepository } from "../groups/group.repository.js";
import {
  customerRepository,
  type CustomerListItemRow,
  type CustomerTransactionRow,
  type ListCustomersParams,
} from "./customer.repository.js";

export interface CustomerListItemResponse {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  vehicle: string | null;
  groupId: string;
  groupName: string;
  status: "active" | "inactive";
  registeredAt: string;
  lastActivity: string | null;
  transactions: number;
  totalSpend: string;
  discountReceived: string;
}

export interface CustomerDetailResponse {
  customer: CustomerListItemResponse & {
    qrToken: string;
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
    workerId: string;
    workerName: string | null;
  }[];
}

export interface CreateCustomerDTO {
  name: string;
  phone: string;
  email?: string | null;
  vehicle?: string | null;
  groupId?: string;
}

export interface UpdateCustomerDTO {
  name?: string;
  phone?: string;
  email?: string | null;
  vehicle?: string | null;
}

function mapCustomerListItem(row: CustomerListItemRow): CustomerListItemResponse {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email ?? null,
    vehicle: row.vehicle ?? null,
    groupId: row.group_id,
    groupName: row.group_name,
    status: row.status,
    registeredAt: row.registered_at.toISOString(),
    lastActivity: row.last_activity_at ? row.last_activity_at.toISOString() : null,
    transactions: Number(row.transactions ?? 0),
    totalSpend: Number(row.total_spend ?? 0).toFixed(2),
    discountReceived: Number(row.discount_received ?? 0).toFixed(2),
  };
}

function mapCustomerTransaction(t: CustomerTransactionRow) {
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
    workerId: t.worker_id,
    workerName: t.worker_name ?? null,
  };
}

export class CustomerService {
  private async getAdminName(adminId: string): Promise<string> {
    const admin = await adminRepository.findById(adminId);
    return admin?.name ?? "Super Admin";
  }

  async listCustomers(params: ListCustomersParams) {
    const { rows, total } = await customerRepository.list(params);
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(100, params.limit ?? 20));
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: rows.map(mapCustomerListItem),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async getCustomerDetail(id: string): Promise<CustomerDetailResponse> {
    const customer = await customerRepository.findById(id);
    if (!customer) {
      throw new NotFoundError("Customer not found", "CUSTOMER_NOT_FOUND");
    }

    const recent = await customerRepository.getRecentTransactions(id, 10);

    return {
      customer: {
        ...mapCustomerListItem(customer),
        qrToken: customer.qr_token,
        createdAt: customer.created_at.toISOString(),
        updatedAt: customer.updated_at.toISOString(),
      },
      recentTransactions: recent.map(mapCustomerTransaction),
    };
  }

  async createCustomer(
    actor: AuthActor,
    dto: CreateCustomerDTO,
    ip?: string,
    userAgent?: string,
  ): Promise<{ customer: CustomerListItemResponse }> {
    const normalizedPhone = normalizeIndianPhone(dto.phone);
    if (!normalizedPhone) {
      throw new BadRequestError("Invalid Indian phone number format.", "INVALID_PHONE");
    }

    const normalizedEmail = dto.email !== undefined ? normalizeEmail(dto.email) : null;

    // Check existing phone
    const existingPhone = await customerRepository.findByPhone(normalizedPhone);
    if (existingPhone) {
      throw new ConflictError("Phone number is already registered.", "PHONE_ALREADY_EXISTS");
    }

    // Check existing email
    if (normalizedEmail) {
      const existingEmail = await customerRepository.findByEmail(normalizedEmail);
      if (existingEmail) {
        throw new ConflictError("Email address is already registered.", "EMAIL_ALREADY_EXISTS");
      }
    }

    // Resolve groupId (or default group)
    let targetGroupId: string;
    let groupName = "Standard (Default)";

    if (dto.groupId) {
      const group = await groupRepository.findById(dto.groupId);
      if (!group) {
        throw new NotFoundError("Target group not found.", "GROUP_NOT_FOUND");
      }
      targetGroupId = group.id;
      groupName = group.name;
    } else {
      const defaultGroup = await groupRepository.findDefaultGroup();
      if (!defaultGroup) {
        throw new InternalServerError(
          "Default group not found in database.",
          "DEFAULT_GROUP_NOT_FOUND",
        );
      }
      targetGroupId = defaultGroup.id;
      groupName = defaultGroup.name;
    }

    const qrToken = generateQrToken();
    const actorName = await this.getAdminName(actor.sub);

    const created = await withTransaction(pool, async (client) => {
      // In-transaction uniqueness check
      const dupPhone = await customerRepository.findByPhone(normalizedPhone, undefined, client);
      if (dupPhone) {
        throw new ConflictError("Phone number is already registered.", "PHONE_ALREADY_EXISTS");
      }
      if (normalizedEmail) {
        const dupEmail = await customerRepository.findByEmail(normalizedEmail, undefined, client);
        if (dupEmail) {
          throw new ConflictError("Email address is already registered.", "EMAIL_ALREADY_EXISTS");
        }
      }

      const row = await customerRepository.create(
        {
          name: dto.name,
          phone: normalizedPhone,
          email: normalizedEmail,
          vehicle: dto.vehicle?.trim() || null,
          groupId: targetGroupId,
          qrToken,
        },
        client,
      );

      // Record customer.created in same tx (NO notification per requirement)
      await auditService.recordInTx(
        {
          actorType: "admin",
          actorId: actor.sub,
          actorName,
          action: "customer.created",
          entityType: "customer",
          entityId: row.id,
          newValue: {
            name: row.name,
            phone: row.phone,
            email: row.email,
            vehicle: row.vehicle,
            groupId: targetGroupId,
          },
          ipAddress: ip,
          userAgent,
        },
        client,
      );

      return row;
    });

    const item: CustomerListItemResponse = {
      id: created.id,
      name: created.name,
      phone: created.phone,
      email: created.email,
      vehicle: created.vehicle,
      groupId: created.group_id,
      groupName,
      status: created.status,
      registeredAt: created.registered_at.toISOString(),
      lastActivity: null,
      transactions: 0,
      totalSpend: "0.00",
      discountReceived: "0.00",
    };

    return { customer: item };
  }

  async updateCustomer(
    actor: AuthActor,
    id: string,
    dto: UpdateCustomerDTO,
    ip?: string,
    userAgent?: string,
  ): Promise<{ customer: CustomerListItemResponse }> {
    let normalizedPhone: string | undefined = undefined;
    if (dto.phone !== undefined) {
      const norm = normalizeIndianPhone(dto.phone);
      if (!norm) {
        throw new BadRequestError("Invalid Indian phone number format.", "INVALID_PHONE");
      }
      normalizedPhone = norm;
    }

    let normalizedEmail: string | null | undefined = undefined;
    if (dto.email !== undefined) {
      normalizedEmail = normalizeEmail(dto.email);
    }

    const actorName = await this.getAdminName(actor.sub);

    const updated = await withTransaction(pool, async (client) => {
      const current = await customerRepository.findByIdForUpdate(id, client);
      if (!current) {
        throw new NotFoundError("Customer not found", "CUSTOMER_NOT_FOUND");
      }

      if (normalizedPhone && normalizedPhone !== current.phone) {
        const dupPhone = await customerRepository.findByPhone(normalizedPhone, id, client);
        if (dupPhone) {
          throw new ConflictError(
            "Phone number is already registered by another customer.",
            "PHONE_ALREADY_EXISTS",
          );
        }
      }

      if (normalizedEmail && normalizedEmail !== current.email) {
        const dupEmail = await customerRepository.findByEmail(normalizedEmail, id, client);
        if (dupEmail) {
          throw new ConflictError(
            "Email address is already registered by another customer.",
            "EMAIL_ALREADY_EXISTS",
          );
        }
      }

      const row = await customerRepository.update(
        id,
        {
          name: dto.name,
          phone: normalizedPhone,
          email: normalizedEmail,
          vehicle: dto.vehicle !== undefined ? dto.vehicle?.trim() || null : undefined,
        },
        client,
      );

      // Diff for audit log
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
      if (dto.vehicle !== undefined && dto.vehicle !== current.vehicle) {
        oldValue.vehicle = current.vehicle;
        newValue.vehicle = row.vehicle;
      }

      if (Object.keys(newValue).length > 0) {
        await auditService.recordInTx(
          {
            actorType: "admin",
            actorId: actor.sub,
            actorName,
            action: "customer.updated",
            entityType: "customer",
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

    const full = await customerRepository.findById(updated.id);
    return { customer: mapCustomerListItem(full!) };
  }

  async updateStatus(
    actor: AuthActor,
    id: string,
    status: "active" | "inactive",
    ip?: string,
    userAgent?: string,
  ): Promise<{ customer: { id: string; status: "active" | "inactive" } }> {
    const actorName = await this.getAdminName(actor.sub);

    const updated = await withTransaction(pool, async (client) => {
      const current = await customerRepository.findByIdForUpdate(id, client);
      if (!current) {
        throw new NotFoundError("Customer not found", "CUSTOMER_NOT_FOUND");
      }

      const row = await customerRepository.updateStatus(id, status, client);

      // Revoke refresh tokens if setting inactive
      if (status === "inactive") {
        await customerRepository.revokeRefreshTokens(id, client);
      }

      await auditService.recordInTx(
        {
          actorType: "admin",
          actorId: actor.sub,
          actorName,
          action: "customer.status_changed",
          entityType: "customer",
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

    return { customer: { id: updated.id, status: updated.status } };
  }

  async assignGroup(
    actor: AuthActor,
    id: string,
    groupId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ customer: { id: string; groupId: string; groupName: string } }> {
    const actorName = await this.getAdminName(actor.sub);

    const result = await withTransaction(pool, async (client) => {
      const current = await customerRepository.findByIdForUpdate(id, client);
      if (!current) {
        throw new NotFoundError("Customer not found", "CUSTOMER_NOT_FOUND");
      }

      const group = await groupRepository.findById(groupId, client);
      if (!group) {
        throw new NotFoundError("Group not found", "GROUP_NOT_FOUND");
      }

      const row = await customerRepository.updateGroup(id, groupId, client);

      await auditService.recordInTx(
        {
          actorType: "admin",
          actorId: actor.sub,
          actorName,
          action: "customer.group_assigned",
          entityType: "customer",
          entityId: id,
          newValue: {
            old_group_id: current.group_id,
            new_group_id: groupId,
            group_name: group.name,
          },
          ipAddress: ip,
          userAgent,
        },
        client,
      );

      return { row, groupName: group.name };
    });

    return {
      customer: {
        id: result.row.id,
        groupId: result.row.group_id,
        groupName: result.groupName,
      },
    };
  }

  async deleteCustomer(
    actor: AuthActor,
    id: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const actorName = await this.getAdminName(actor.sub);

    await withTransaction(pool, async (client) => {
      const current = await customerRepository.findByIdForUpdate(id, client);
      if (!current) {
        throw new NotFoundError("Customer not found", "CUSTOMER_NOT_FOUND");
      }

      await customerRepository.softDelete(id, client);
      // Revoke customer refresh tokens on delete
      await customerRepository.revokeRefreshTokens(id, client);

      await auditService.recordInTx(
        {
          actorType: "admin",
          actorId: actor.sub,
          actorName,
          action: "customer.deleted",
          entityType: "customer",
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

    return { message: "Customer deleted successfully" };
  }
}

export const customerService = new CustomerService();
