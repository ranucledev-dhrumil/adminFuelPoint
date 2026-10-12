import crypto from "node:crypto";
import type pg from "pg";
import * as argon2 from "@node-rs/argon2";
import { env } from "../config/env.js";
import { pool } from "../db/pool.js";
import { logger } from "../common/utils/logger.js";

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ADM";
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export async function seedFirstAdmin(client: pg.Pool | pg.PoolClient = pool): Promise<void> {
  const check = await client.query("SELECT id, email FROM admin_users LIMIT 1");
  if (check.rowCount && check.rowCount > 0) {
    logger.info("Admin user already exists, skipping admin seed.");
    return;
  }

  const name = env.SEED_ADMIN_NAME?.trim() || "Super Admin";
  const email = (env.SEED_ADMIN_EMAIL?.trim() || "admin@fuelpoint.local").toLowerCase();

  const generatedPassword = crypto
    .randomBytes(12)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "x")
    .slice(0, 16);
  const password = env.SEED_ADMIN_INITIAL_PASSWORD?.trim() || generatedPassword;
  const isGenerated = !env.SEED_ADMIN_INITIAL_PASSWORD?.trim();

  const passwordHash = await argon2.hash(password);
  const initials = deriveInitials(name);

  const query = `
    INSERT INTO admin_users (name, email, password_hash, role, initials, is_active)
    VALUES ($1, $2, $3, 'Super Admin', $4, TRUE)
    RETURNING id, name, email;
  `;

  await client.query(query, [name, email, passwordHash, initials]);
  logger.info({ email, name }, "Seeded initial Super Admin account");

  if (isGenerated || env.NODE_ENV !== "production") {
    // Print credentials once to console for initial local login as specified by owner decisions
    console.log("\n============================================================");
    console.log("Initial Super Admin Account Created");
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log("Please change this password immediately after your first login.");
    console.log("============================================================\n");
  }
}
