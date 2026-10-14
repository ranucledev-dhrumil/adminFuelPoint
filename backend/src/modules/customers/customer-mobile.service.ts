import { pool } from "../../db/pool.js";
import { withTransaction } from "../../db/transaction.js";
import { env } from "../../config/env.js";
import { customerRepository } from "./customer.repository.js";
import { otpService } from "../otp/otp.service.js";
import { otpRepository } from "../otp/otp.repository.js";
import { authRepository } from "../auth/auth.repository.js";
import { groupRepository } from "../groups/group.repository.js";
import { DEFAULT_GROUP_ID } from "../../seeds/default-group.seed.js";
import { notificationService } from "../notifications/notification.service.js";
import { auditService } from "../audit/audit.service.js";
import { normalizeIndianPhone } from "../../common/utils/phone.js";
import {
  generateQrToken,
  generateOpaqueToken,
  hashSha256,
  signAccessToken,
} from "../../common/utils/crypto.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../common/errors/app-error.js";
import type { AuthActor } from "../../common/types/common.js";

export interface RegisterCustomerDTO {
  phone: string;
  name: string;
  code: string;
}

export interface CustomerRegisterResult {
  accessToken: string;
  refreshToken: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    qrToken: string;
    status: string;
  };
}

export interface CustomerQrResult {
  qrToken: string;
  name: string;
  status: string;
}

export interface RegenerateQrResult {
  qrToken: string;
  regeneratedAt: string;
}

export interface CustomerProfileResult {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  vehicle: string | null;
  status: string;
  groupName: string;
}

export interface UpdateCustomerProfileDTO {
  name?: string;
  email?: string | null;
  vehicle?: string | null;
  phone?: unknown;
}

export interface CustomerUpdateProfileResult {
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    vehicle: string | null;
    status: string;
  };
}

export class CustomerMobileService {
  async register(
    dto: RegisterCustomerDTO,
    ip?: string,
    userAgent?: string,
  ): Promise<CustomerRegisterResult> {
    const normalizedPhone = normalizeIndianPhone(dto.phone);
    if (!normalizedPhone) {
      throw new BadRequestError("Invalid phone number format.", "INVALID_PHONE");
    }

    if (!dto.name || dto.name.trim().length < 2) {
      throw new BadRequestError("Name must be at least 2 characters.", "INVALID_NAME");
    }

    // 1. Verify OTP code
    const otpRow = await otpService.verifyRegisterOtp(normalizedPhone, dto.code);

    // 2. Perform atomic customer creation
    const { createdCustomer, rawRefreshToken } = await withTransaction(pool, async (client) => {
      // Mark OTP consumed
      await otpRepository.markConsumed(otpRow.id, client);

      // Check duplicate phone in transaction
      const dup = await customerRepository.findByPhone(normalizedPhone, undefined, client);
      if (dup) {
        throw new ConflictError("Phone number is already registered.", "PHONE_ALREADY_EXISTS");
      }

      // Resolve default group
      const defaultGroup = await groupRepository.findDefaultGroup(client);
      const groupId = defaultGroup ? defaultGroup.id : DEFAULT_GROUP_ID;

      const qrToken = generateQrToken();

      // Insert customer
      const query = `
        INSERT INTO customers (name, phone, qr_token, group_id, status)
        VALUES ($1, $2, $3, $4, 'active')
        RETURNING id, name, phone, qr_token, status, created_at;
      `;
      const res = await client.query<{
        id: string;
        name: string;
        phone: string;
        qr_token: string;
        status: string;
      }>(query, [dto.name.trim(), normalizedPhone, qrToken, groupId]);
      const customer = res.rows[0];

      // Create notification: Customer Registration
      await notificationService.notifyCustomerRegistered(customer.id, customer.name, client);

      // Audit log: customer.created (omitting qrToken)
      await auditService.recordInTx(
        {
          actorType: "customer",
          actorId: customer.id,
          actorName: customer.name,
          action: "customer.created",
          entityType: "customer",
          entityId: customer.id,
          newValue: {
            name: customer.name,
            phone: customer.phone,
            status: customer.status,
            groupId,
          },
          ipAddress: ip,
          userAgent,
        },
        client,
      );

      // Issue refresh token
      const rawToken = generateOpaqueToken(32);
      const tokenHash = hashSha256(rawToken);
      const expiresAt = new Date(
        Date.now() + env.USER_REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      );

      await authRepository.createRefreshToken(
        {
          tokenHash,
          customerId: customer.id,
          expiresAt,
          ipAddress: ip,
          userAgent,
        },
        client,
      );

      return { createdCustomer: customer, rawRefreshToken: rawToken };
    });

    const accessToken = signAccessToken({
      sub: createdCustomer.id,
      role: "customer",
      aud: "fuelpoint-customer",
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      customer: {
        id: createdCustomer.id,
        name: createdCustomer.name,
        phone: createdCustomer.phone,
        qrToken: createdCustomer.qr_token,
        status: createdCustomer.status,
      },
    };
  }

  async getQr(actor: AuthActor): Promise<CustomerQrResult> {
    const customer = await customerRepository.findById(actor.sub);
    if (!customer || customer.deleted_at) {
      throw new NotFoundError("Customer not found.", "CUSTOMER_NOT_FOUND");
    }

    if (customer.status !== "active") {
      throw new ForbiddenError("Customer account is inactive.", "CUSTOMER_INACTIVE");
    }

    return {
      qrToken: customer.qr_token,
      name: customer.name,
      status: customer.status,
    };
  }

  async regenerateQr(
    actor: AuthActor,
    ip?: string,
    userAgent?: string,
  ): Promise<RegenerateQrResult> {
    const customer = await customerRepository.findById(actor.sub);
    if (!customer || customer.deleted_at) {
      throw new NotFoundError("Customer not found.", "CUSTOMER_NOT_FOUND");
    }

    if (customer.status !== "active") {
      throw new ForbiddenError("Customer account is inactive.", "CUSTOMER_INACTIVE");
    }

    const newQrToken = generateQrToken();

    const updated = await withTransaction(pool, async (client) => {
      const query = `
        UPDATE customers
        SET qr_token = $2, updated_at = now()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, qr_token, updated_at;
      `;
      const res = await client.query<{ qr_token: string; updated_at: Date }>(query, [
        actor.sub,
        newQrToken,
      ]);

      if (res.rowCount === 0) {
        throw new NotFoundError("Customer not found.", "CUSTOMER_NOT_FOUND");
      }

      // Record audit log WITHOUT the token value
      await auditService.recordInTx(
        {
          actorType: "customer",
          actorId: actor.sub,
          actorName: customer.name,
          action: "customer.qr_regenerated",
          entityType: "customer",
          entityId: actor.sub,
          newValue: { regenerated: true },
          ipAddress: ip,
          userAgent,
        },
        client,
      );

      return res.rows[0];
    });

    return {
      qrToken: updated.qr_token,
      regeneratedAt: updated.updated_at.toISOString(),
    };
  }

  async getProfile(actor: AuthActor): Promise<CustomerProfileResult> {
    const customer = await customerRepository.findById(actor.sub);
    if (!customer || customer.deleted_at || customer.status !== "active") {
      throw new ForbiddenError("Customer account is inactive.", "CUSTOMER_INACTIVE");
    }

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      vehicle: customer.vehicle,
      status: customer.status,
      groupName: customer.group_name || "Standard (Default)",
    };
  }

  async updateProfile(
    actor: AuthActor,
    dto: UpdateCustomerProfileDTO,
    ip?: string,
    userAgent?: string,
  ): Promise<CustomerUpdateProfileResult> {
    const customer = await customerRepository.findById(actor.sub);
    if (!customer || customer.deleted_at || customer.status !== "active") {
      throw new ForbiddenError("Customer account is inactive.", "CUSTOMER_INACTIVE");
    }

    let normalizedEmail: string | null | undefined = undefined;
    if (dto.email !== undefined) {
      normalizedEmail =
        dto.email && dto.email.trim() !== "" ? dto.email.trim().toLowerCase() : null;
    }

    const updated = await withTransaction(pool, async (client) => {
      const current = await customerRepository.findByIdForUpdate(actor.sub, client);
      if (!current || current.deleted_at || current.status !== "active") {
        throw new ForbiddenError("Customer account is inactive.", "CUSTOMER_INACTIVE");
      }

      if (normalizedEmail && normalizedEmail !== current.email) {
        const dupEmail = await customerRepository.findByEmail(normalizedEmail, actor.sub, client);
        if (dupEmail) {
          throw new ConflictError(
            "Email address is already in use by another customer.",
            "EMAIL_ALREADY_EXISTS",
          );
        }
      }

      const row = await customerRepository.update(
        actor.sub,
        {
          name: dto.name !== undefined ? dto.name.trim() : undefined,
          email: normalizedEmail,
          vehicle: dto.vehicle !== undefined ? dto.vehicle?.trim() || null : undefined,
        },
        client,
      );

      // Diff for audit log (changed fields only, no secrets)
      const oldValue: Record<string, unknown> = {};
      const newValue: Record<string, unknown> = {};

      if (dto.name !== undefined && dto.name.trim() !== current.name) {
        oldValue.name = current.name;
        newValue.name = row.name;
      }
      if (normalizedEmail !== undefined && normalizedEmail !== current.email) {
        oldValue.email = current.email;
        newValue.email = row.email;
      }
      const newVeh = dto.vehicle !== undefined ? dto.vehicle?.trim() || null : undefined;
      if (dto.vehicle !== undefined && newVeh !== current.vehicle) {
        oldValue.vehicle = current.vehicle;
        newValue.vehicle = row.vehicle;
      }

      if (Object.keys(newValue).length > 0) {
        await auditService.recordInTx(
          {
            actorType: "customer",
            actorId: actor.sub,
            actorName: row.name,
            action: "customer.updated",
            entityType: "customer",
            entityId: actor.sub,
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

    return {
      customer: {
        id: updated.id,
        name: updated.name,
        phone: updated.phone,
        email: updated.email,
        vehicle: updated.vehicle,
        status: updated.status,
      },
    };
  }
}

export const customerMobileService = new CustomerMobileService();
