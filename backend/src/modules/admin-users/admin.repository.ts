import type pg from "pg";
import { pool } from "../../db/pool.js";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  password_hash: string;
  role: string;
  location: string | null;
  initials: string;
  avatar_url: string | null;
  is_active: boolean;
  joined_at: Date;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class AdminRepository {
  async findByEmail(
    email: string,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<AdminUserRow | null> {
    const query = `
      SELECT id, name, email, phone, password_hash, role, location,
             initials, avatar_url, is_active, joined_at, last_login_at,
             created_at, updated_at
      FROM admin_users
      WHERE email = $1;
    `;
    const res = await client.query(query, [email.toLowerCase().trim()]);
    return res.rows[0] || null;
  }

  async findById(id: string, client: pg.Pool | pg.PoolClient = pool): Promise<AdminUserRow | null> {
    const query = `
      SELECT id, name, email, phone, password_hash, role, location,
             initials, avatar_url, is_active, joined_at, last_login_at,
             created_at, updated_at
      FROM admin_users
      WHERE id = $1;
    `;
    const res = await client.query(query, [id]);
    return res.rows[0] || null;
  }

  async updateLastLogin(id: string, client: pg.Pool | pg.PoolClient = pool): Promise<void> {
    const query = `
      UPDATE admin_users
      SET last_login_at = now()
      WHERE id = $1;
    `;
    await client.query(query, [id]);
  }

  async updatePassword(
    id: string,
    passwordHash: string,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<void> {
    const query = `
      UPDATE admin_users
      SET password_hash = $2
      WHERE id = $1;
    `;
    await client.query(query, [id, passwordHash]);
  }

  async updateProfile(
    id: string,
    patch: {
      name?: string;
      phone?: string | null;
      location?: string | null;
      initials?: string;
    },
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<AdminUserRow> {
    const fields: string[] = [];
    const values: unknown[] = [id];
    let idx = 2;

    if (patch.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(patch.name);
    }
    if (patch.phone !== undefined) {
      fields.push(`phone = $${idx++}`);
      values.push(patch.phone);
    }
    if (patch.location !== undefined) {
      fields.push(`location = $${idx++}`);
      values.push(patch.location);
    }
    if (patch.initials !== undefined) {
      fields.push(`initials = $${idx++}`);
      values.push(patch.initials);
    }

    if (fields.length === 0) {
      const current = await this.findById(id, client);
      if (!current) throw new Error("Admin not found");
      return current;
    }

    const query = `
      UPDATE admin_users
      SET ${fields.join(", ")}
      WHERE id = $1
      RETURNING id, name, email, phone, password_hash, role, location,
                initials, avatar_url, is_active, joined_at, last_login_at,
                created_at, updated_at;
    `;
    const res = await client.query(query, values);
    return res.rows[0];
  }

  async updateIsActive(
    id: string,
    isActive: boolean,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<void> {
    const query = `
      UPDATE admin_users
      SET is_active = $2
      WHERE id = $1;
    `;
    await client.query(query, [id, isActive]);
  }
}

export const adminRepository = new AdminRepository();
