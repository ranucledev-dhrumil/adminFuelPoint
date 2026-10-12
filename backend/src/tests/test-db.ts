import pg from "pg";
import { runMigrations } from "../db/migrate.js";

export const testPool = new pg.Pool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 5433),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: "fuelpoint_test",
  max: 10,
  idleTimeoutMillis: 10000,
});

export async function ensureTestDatabaseMigrated(): Promise<void> {
  await runMigrations({ database: "fuelpoint_test", direction: "up" });
}

export async function truncateAllTables(): Promise<void> {
  await testPool.query(`
    TRUNCATE TABLE 
      transactions,
      refresh_tokens,
      otp_codes,
      admin_password_reset_tokens,
      notifications,
      audit_logs,
      customers,
      workers,
      groups,
      admin_users
    RESTART IDENTITY CASCADE;
  `);
}
