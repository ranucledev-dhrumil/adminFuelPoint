import type pg from "pg";
import { pool } from "../../db/pool.js";

export interface RefreshTokenRow {
  id: string;
  token_hash: string;
  admin_user_id: string | null;
  customer_id: string | null;
  worker_id: string | null;
  expires_at: Date;
  revoked_at: Date | null;
  replaced_by: string | null;
  last_used_at: Date | null;
}

export interface PasswordResetTokenRow {
  id: string;
  admin_user_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
}

export class AuthRepository {
  async createRefreshToken(
    params: {
      tokenHash: string;
      adminUserId?: string | null;
      customerId?: string | null;
      workerId?: string | null;
      expiresAt: Date;
      userAgent?: string | null;
      ipAddress?: string | null;
    },
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<string> {
    const query = `
      INSERT INTO refresh_tokens (
        token_hash, admin_user_id, customer_id, worker_id,
        expires_at, user_agent, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;
    `;
    const res = await client.query(query, [
      params.tokenHash,
      params.adminUserId || null,
      params.customerId || null,
      params.workerId || null,
      params.expiresAt,
      params.userAgent || null,
      params.ipAddress || null,
    ]);
    return res.rows[0].id;
  }

  async findRefreshTokenByHash(
    tokenHash: string,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<RefreshTokenRow | null> {
    const query = `
      SELECT id, token_hash, admin_user_id, customer_id, worker_id,
             expires_at, revoked_at, replaced_by, last_used_at
      FROM refresh_tokens
      WHERE token_hash = $1;
    `;
    const res = await client.query(query, [tokenHash]);
    return res.rows[0] || null;
  }

  async rotateRefreshToken(
    oldId: string,
    newId: string,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<void> {
    const query = `
      UPDATE refresh_tokens
      SET revoked_at = now(), replaced_by = $2, last_used_at = now()
      WHERE id = $1;
    `;
    await client.query(query, [oldId, newId]);
  }

  async revokeTokenByHash(
    tokenHash: string,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<void> {
    const query = `
      UPDATE refresh_tokens
      SET revoked_at = now()
      WHERE token_hash = $1 AND revoked_at IS NULL;
    `;
    await client.query(query, [tokenHash]);
  }

  async revokeAllTokensForAdmin(
    adminUserId: string,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<void> {
    const query = `
      UPDATE refresh_tokens
      SET revoked_at = now()
      WHERE admin_user_id = $1 AND revoked_at IS NULL;
    `;
    await client.query(query, [adminUserId]);
  }

  async revokeAllTokensForActor(
    actor: { adminId?: string | null; customerId?: string | null; workerId?: string | null },
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<void> {
    const query = `
      UPDATE refresh_tokens
      SET revoked_at = now()
      WHERE (
        ($1::uuid IS NOT NULL AND admin_user_id = $1) OR
        ($2::uuid IS NOT NULL AND customer_id = $2) OR
        ($3::uuid IS NOT NULL AND worker_id = $3)
      ) AND revoked_at IS NULL;
    `;
    await client.query(query, [
      actor.adminId || null,
      actor.customerId || null,
      actor.workerId || null,
    ]);
  }

  async createPasswordResetToken(
    params: { adminUserId: string; tokenHash: string; expiresAt: Date },
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<string> {
    const query = `
      INSERT INTO admin_password_reset_tokens (admin_user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      RETURNING id;
    `;
    const res = await client.query(query, [params.adminUserId, params.tokenHash, params.expiresAt]);
    return res.rows[0].id;
  }

  async invalidateExistingResetTokens(
    adminUserId: string,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<void> {
    const query = `
      UPDATE admin_password_reset_tokens
      SET used_at = now()
      WHERE admin_user_id = $1 AND used_at IS NULL;
    `;
    await client.query(query, [adminUserId]);
  }

  async findValidResetToken(
    tokenHash: string,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<PasswordResetTokenRow | null> {
    const query = `
      SELECT id, admin_user_id, token_hash, expires_at, used_at
      FROM admin_password_reset_tokens
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now();
    `;
    const res = await client.query(query, [tokenHash]);
    return res.rows[0] || null;
  }

  async markResetTokenUsed(id: string, client: pg.Pool | pg.PoolClient = pool): Promise<void> {
    const query = `
      UPDATE admin_password_reset_tokens
      SET used_at = now()
      WHERE id = $1;
    `;
    await client.query(query, [id]);
  }
}

export const authRepository = new AuthRepository();
