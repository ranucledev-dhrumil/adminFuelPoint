import { pool } from "../../db/pool.js";
import { withTransaction } from "../../db/transaction.js";
import {
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
} from "../../common/errors/app-error.js";
import type { AuthActor } from "../../common/types/common.js";
import { auditService } from "../audit/audit.service.js";
import { adminRepository } from "../admin-users/admin.repository.js";
import {
  groupRepository,
  type GroupRow,
  type GroupWithCustomerCountRow,
  type CreateGroupParams,
  type UpdateGroupParams,
} from "./group.repository.js";

export interface GroupResponse {
  id: string;
  name: string;
  discountPercent: string;
  description: string | null;
  active: boolean;
  isDefault: boolean;
  customerCount: number;
  createdAt: string;
  updatedAt?: string;
}

function mapGroupResponse(
  row: GroupRow | GroupWithCustomerCountRow,
  customerCountOverride?: number,
): GroupResponse {
  const count =
    customerCountOverride !== undefined
      ? customerCountOverride
      : "customer_count" in row
        ? Number(row.customer_count ?? 0)
        : 0;

  return {
    id: row.id,
    name: row.name,
    discountPercent: Number(row.discount_percent).toFixed(2),
    description: row.description ?? null,
    active: row.active,
    isDefault: row.is_default,
    customerCount: count,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at ? row.updated_at.toISOString() : undefined,
  };
}

export class GroupService {
  private async getAdminName(adminId: string): Promise<string> {
    const admin = await adminRepository.findById(adminId);
    return admin?.name ?? "Super Admin";
  }

  async listGroups(): Promise<GroupResponse[]> {
    const groups = await groupRepository.findAllWithCustomerCount();
    return groups.map((g) => mapGroupResponse(g));
  }

  async createGroup(
    actor: AuthActor,
    params: CreateGroupParams,
    ip?: string,
    userAgent?: string,
  ): Promise<GroupResponse> {
    const existing = await groupRepository.findByName(params.name);
    if (existing) {
      throw new ConflictError("A group with this name already exists", "DUPLICATE_GROUP_NAME");
    }

    const actorName = await this.getAdminName(actor.sub);

    const createdGroup = await withTransaction(pool, async (client) => {
      // In-transaction double check
      const duplicateInTx = await groupRepository.findByName(params.name, undefined, client);
      if (duplicateInTx) {
        throw new ConflictError("A group with this name already exists", "DUPLICATE_GROUP_NAME");
      }

      const group = await groupRepository.create(params, client);

      await auditService.recordInTx(
        {
          actorType: "admin",
          actorId: actor.sub,
          actorName,
          action: "group.created",
          entityType: "group",
          entityId: group.id,
          newValue: {
            name: group.name,
            discountPercent: Number(group.discount_percent).toFixed(2),
            description: group.description,
            active: group.active,
          },
          ipAddress: ip,
          userAgent,
        },
        client,
      );

      return group;
    });

    return mapGroupResponse(createdGroup, 0);
  }

  async editGroup(
    actor: AuthActor,
    id: string,
    params: UpdateGroupParams,
    ip?: string,
    userAgent?: string,
  ): Promise<GroupResponse> {
    const actorName = await this.getAdminName(actor.sub);

    const result = await withTransaction(pool, async (client) => {
      const existing = await groupRepository.findByIdForUpdate(id, client);
      if (!existing) {
        throw new NotFoundError("Group not found", "GROUP_NOT_FOUND");
      }

      if (params.name && params.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
        const duplicate = await groupRepository.findByName(params.name, id, client);
        if (duplicate) {
          throw new ConflictError("A group with this name already exists", "DUPLICATE_GROUP_NAME");
        }
      }

      const updated = await groupRepository.update(id, params, client);

      // Compute changed values for audit trail
      const oldValue: Record<string, unknown> = {};
      const newValue: Record<string, unknown> = {};

      if (params.name !== undefined && params.name.trim() !== existing.name) {
        oldValue.name = existing.name;
        newValue.name = updated.name;
      }
      if (
        params.discountPercent !== undefined &&
        Number(params.discountPercent).toFixed(2) !== Number(existing.discount_percent).toFixed(2)
      ) {
        oldValue.discountPercent = Number(existing.discount_percent).toFixed(2);
        newValue.discountPercent = Number(updated.discount_percent).toFixed(2);
      }
      if (params.description !== undefined && params.description !== existing.description) {
        oldValue.description = existing.description;
        newValue.description = updated.description;
      }

      if (Object.keys(newValue).length > 0) {
        await auditService.recordInTx(
          {
            actorType: "admin",
            actorId: actor.sub,
            actorName,
            action: "group.updated",
            entityType: "group",
            entityId: updated.id,
            oldValue,
            newValue,
            ipAddress: ip,
            userAgent,
          },
          client,
        );
      }

      // Fetch customer count
      const countRes = await client.query<{ count: string }>(
        "SELECT COUNT(*)::int AS count FROM customers WHERE group_id = $1 AND deleted_at IS NULL",
        [id],
      );
      const customerCount = Number(countRes.rows[0]?.count ?? 0);

      return { updated, customerCount };
    });

    return mapGroupResponse(result.updated, result.customerCount);
  }

  async toggleActive(
    actor: AuthActor,
    id: string,
    ip?: string,
    userAgent?: string,
  ): Promise<GroupResponse> {
    const actorName = await this.getAdminName(actor.sub);

    const result = await withTransaction(pool, async (client) => {
      const existing = await groupRepository.findByIdForUpdate(id, client);
      if (!existing) {
        throw new NotFoundError("Group not found", "GROUP_NOT_FOUND");
      }

      if (existing.is_default) {
        throw new BadRequestError(
          "The default group cannot be deactivated",
          "CANNOT_DEACTIVATE_DEFAULT_GROUP",
        );
      }

      const updated = await groupRepository.toggleActive(id, client);

      await auditService.recordInTx(
        {
          actorType: "admin",
          actorId: actor.sub,
          actorName,
          action: "group.toggled",
          entityType: "group",
          entityId: updated.id,
          oldValue: { active: existing.active },
          newValue: { active: updated.active },
          ipAddress: ip,
          userAgent,
        },
        client,
      );

      const countRes = await client.query<{ count: string }>(
        "SELECT COUNT(*)::int AS count FROM customers WHERE group_id = $1 AND deleted_at IS NULL",
        [id],
      );
      const customerCount = Number(countRes.rows[0]?.count ?? 0);

      return { updated, customerCount };
    });

    return mapGroupResponse(result.updated, result.customerCount);
  }

  async deleteGroup(
    actor: AuthActor,
    id: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const actorName = await this.getAdminName(actor.sub);

    await withTransaction(pool, async (client) => {
      const existing = await groupRepository.findByIdForUpdate(id, client);
      if (!existing) {
        throw new NotFoundError("Group not found", "GROUP_NOT_FOUND");
      }

      if (existing.is_default) {
        throw new BadRequestError(
          "The default group cannot be deleted",
          "CANNOT_DELETE_DEFAULT_GROUP",
        );
      }

      const defaultGroup = await groupRepository.findDefaultGroup(client);
      if (!defaultGroup) {
        throw new InternalServerError(
          "Default group not found in database",
          "DEFAULT_GROUP_NOT_FOUND",
        );
      }

      // Reassign all members of this group to the default group
      const reassignedCount = await groupRepository.reassignCustomers(id, defaultGroup.id, client);

      // Soft delete group
      await groupRepository.softDelete(id, client);

      // Record audit entry in the same transaction
      await auditService.recordInTx(
        {
          actorType: "admin",
          actorId: actor.sub,
          actorName,
          action: "group.deleted",
          entityType: "group",
          entityId: id,
          newValue: {
            name: existing.name,
            membersReassigned: reassignedCount,
          },
          ipAddress: ip,
          userAgent,
        },
        client,
      );
    });

    return { message: "Group deleted; members reassigned to default group" };
  }
}

export const groupService = new GroupService();
