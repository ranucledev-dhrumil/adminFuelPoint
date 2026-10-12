import type pg from "pg";
import { pool } from "../../db/pool.js";

export type OtpChannel = "sms" | "email";
export type OtpActorType = "customer" | "worker";
export type OtpPurpose = "login" | "register";

export interface OtpCodeRow {
  id: string;
  channel: OtpChannel;
  destination: string;
  actor_type: OtpActorType | null;
  actor_id: string | null;
  code_hash: string;
  purpose: OtpPurpose;
  request_ip: string | null;
  expires_at: Date;
  attempts: number;
  consumed_at: Date | null;
  created_at: Date;
}

export interface CreateOtpParams {
  channel: OtpChannel;
  destination: string;
  actorType?: OtpActorType | null;
  actorId?: string | null;
  codeHash: string;
  purpose: OtpPurpose;
  requestIp?: string | null;
  expiresAt: Date;
}

export class OtpRepository {
  async create(
    params: CreateOtpParams,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<OtpCodeRow> {
    const query = `
      INSERT INTO otp_codes (
        channel, destination, actor_type, actor_id, code_hash,
        purpose, request_ip, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const res = await client.query<OtpCodeRow>(query, [
      params.channel,
      params.destination,
      params.actorType || null,
      params.actorId || null,
      params.codeHash,
      params.purpose,
      params.requestIp || null,
      params.expiresAt,
    ]);
    return res.rows[0];
  }

  async getLatestUnconsumed(
    destination: string,
    purpose: OtpPurpose,
    actorType?: OtpActorType | null,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<OtpCodeRow | null> {
    let query: string;
    let params: unknown[];

    if (actorType) {
      query = `
        SELECT *
        FROM otp_codes
        WHERE destination = $1 AND purpose = $2 AND actor_type = $3 AND consumed_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1;
      `;
      params = [destination, purpose, actorType];
    } else {
      query = `
        SELECT *
        FROM otp_codes
        WHERE destination = $1 AND purpose = $2 AND consumed_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1;
      `;
      params = [destination, purpose];
    }

    const res = await client.query<OtpCodeRow>(query, params);
    return res.rows[0] || null;
  }

  async getRecentOtpForDestination(
    destination: string,
    channel: OtpChannel = "sms",
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<Date | null> {
    const query = `
      SELECT created_at
      FROM otp_codes
      WHERE destination = $1 AND channel = $2
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const res = await client.query<{ created_at: Date }>(query, [destination, channel]);
    return res.rows[0]?.created_at || null;
  }

  async countHourlyOtpsForDestination(
    destination: string,
    channel: OtpChannel = "sms",
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<number> {
    const query = `
      SELECT COUNT(*)::int AS count
      FROM otp_codes
      WHERE destination = $1 AND channel = $2 AND created_at > now() - interval '1 hour';
    `;
    const res = await client.query<{ count: number }>(query, [destination, channel]);
    return res.rows[0]?.count ?? 0;
  }

  async countHourlyRegistrationOtpsForIp(
    ip: string,
    client: pg.Pool | pg.PoolClient = pool,
  ): Promise<number> {
    const query = `
      SELECT COUNT(*)::int AS count
      FROM otp_codes
      WHERE request_ip = $1 AND purpose = 'register' AND created_at > now() - interval '1 hour';
    `;
    const res = await client.query<{ count: number }>(query, [ip]);
    return res.rows[0]?.count ?? 0;
  }

  async incrementAttempts(id: string, client: pg.Pool | pg.PoolClient = pool): Promise<number> {
    const query = `
      UPDATE otp_codes
      SET attempts = attempts + 1
      WHERE id = $1
      RETURNING attempts;
    `;
    const res = await client.query<{ attempts: number }>(query, [id]);
    return res.rows[0]?.attempts ?? 0;
  }

  async markConsumed(id: string, client: pg.Pool | pg.PoolClient = pool): Promise<void> {
    const query = `
      UPDATE otp_codes
      SET consumed_at = now()
      WHERE id = $1;
    `;
    await client.query(query, [id]);
  }
}

export const otpRepository = new OtpRepository();
