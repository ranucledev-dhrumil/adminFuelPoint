import type pg from "pg";
import { pool } from "../../db/pool.js";

export interface GroupRow {
  id: string;
  name: string;
  discount_percent: string;
  description: string | null;
  active: boolean;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface GroupWithCustomerCountRow extends GroupRow {
  customer_count: number | string;
}

export interface CreateGroupParams {
  name: string;
  discountPercent: number;
  description?: string | null;
  active?: boolean;
}

export interface UpdateGroupParams {
  name?: string;
  discountPercent?: number;
  description?: string | null;
}

export class GroupRepository {
  async findAllWithCustomerCount(
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<GroupWithCustomerCountRow[]> {
    const query = `
      SELECT
        g.id,
        g.name,
        g.discount_percent,
        g.description,
        g.active,
        g.is_default,
        g.created_at,
        g.updated_at,
        g.deleted_at,
        COUNT(c.id) FILTER (WHERE c.deleted_at IS NULL)::int AS customer_count
      FROM groups g
      LEFT JOIN customers c ON c.group_id = g.id
      WHERE g.deleted_at IS NULL
      GROUP BY g.id
      ORDER BY g.is_default DESC, g.name ASC;
    `;
    const result = await client.query<GroupWithCustomerCountRow>(query);
    return result.rows;
  }

  async findById(
    id: string,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<GroupWithCustomerCountRow | null> {
    const query = `
      SELECT
        g.id,
        g.name,
        g.discount_percent,
        g.description,
        g.active,
        g.is_default,
        g.created_at,
        g.updated_at,
        g.deleted_at,
        COUNT(c.id) FILTER (WHERE c.deleted_at IS NULL)::int AS customer_count
      FROM groups g
      LEFT JOIN customers c ON c.group_id = g.id
      WHERE g.id = $1 AND g.deleted_at IS NULL
      GROUP BY g.id;
    `;
    const result = await client.query<GroupWithCustomerCountRow>(query, [id]);
    return result.rows[0] ?? null;
  }

  async findByIdForUpdate(id: string, client: pg.PoolClient): Promise<GroupRow | null> {
    const query = `
      SELECT *
      FROM groups
      WHERE id = $1 AND deleted_at IS NULL
      FOR UPDATE;
    `;
    const result = await client.query<GroupRow>(query, [id]);
    return result.rows[0] ?? null;
  }

  async findByName(
    name: string,
    excludeId?: string,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<GroupRow | null> {
    let query: string;
    let params: unknown[];

    if (excludeId) {
      query = `
        SELECT *
        FROM groups
        WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))
          AND id != $2
          AND deleted_at IS NULL
        LIMIT 1;
      `;
      params = [name, excludeId];
    } else {
      query = `
        SELECT *
        FROM groups
        WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))
          AND deleted_at IS NULL
        LIMIT 1;
      `;
      params = [name];
    }

    const result = await client.query<GroupRow>(query, params);
    return result.rows[0] ?? null;
  }

  async findDefaultGroup(client: pg.Pool | pg.PoolClient = pool): Promise<GroupRow | null> {
    const query = `
      SELECT *
      FROM groups
      WHERE is_default = TRUE AND deleted_at IS NULL
      LIMIT 1;
    `;
    const result = await client.query<GroupRow>(query);
    return result.rows[0] ?? null;
  }

  async create(params: CreateGroupParams, client: pg.PoolClient): Promise<GroupRow> {
    const query = `
      INSERT INTO groups (name, discount_percent, description, active, is_default)
      VALUES ($1, $2, $3, $4, FALSE)
      RETURNING *;
    `;
    const result = await client.query<GroupRow>(query, [
      params.name.trim(),
      params.discountPercent,
      params.description !== undefined ? params.description : null,
      params.active ?? true,
    ]);
    return result.rows[0];
  }

  async update(id: string, params: UpdateGroupParams, client: pg.PoolClient): Promise<GroupRow> {
    const setClauses: string[] = [];
    const values: unknown[] = [id];
    let paramIndex = 2;

    if (params.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(params.name.trim());
    }

    if (params.discountPercent !== undefined) {
      setClauses.push(`discount_percent = $${paramIndex++}`);
      values.push(params.discountPercent);
    }

    if (params.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(params.description);
    }

    setClauses.push("updated_at = now()");

    const query = `
      UPDATE groups
      SET ${setClauses.join(", ")}
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;

    const result = await client.query<GroupRow>(query, values);
    return result.rows[0];
  }

  async toggleActive(id: string, client: pg.PoolClient): Promise<GroupRow> {
    const query = `
      UPDATE groups
      SET active = NOT active, updated_at = now()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;
    const result = await client.query<GroupRow>(query, [id]);
    return result.rows[0];
  }

  async reassignCustomers(
    fromGroupId: string,
    toGroupId: string,
    client: pg.PoolClient,
  ): Promise<number> {
    const query = `
      UPDATE customers
      SET group_id = $2, updated_at = now()
      WHERE group_id = $1
      RETURNING id;
    `;
    const result = await client.query(query, [fromGroupId, toGroupId]);
    return result.rowCount ?? 0;
  }

  async softDelete(id: string, client: pg.PoolClient): Promise<void> {
    const query = `
      UPDATE groups
      SET deleted_at = now(), updated_at = now()
      WHERE id = $1;
    `;
    await client.query(query, [id]);
  }
}

export const groupRepository = new GroupRepository();
