import type pg from "pg";
import { pool } from "../db/pool.js";
import { logger } from "../common/utils/logger.js";

export interface CleanupResult {
  expiredOtpsDeleted: number;
  expiredRefreshTokensDeleted: number;
  expiredResetTokensDeleted: number;
}

/**
 * Prunes expired security tokens and codes from the database.
 * Explicitly leaves notifications untouched.
 */
export async function cleanupExpiredRecords(
  client: pg.Pool | pg.PoolClient = pool,
): Promise<CleanupResult> {
  // 1. Prune expired or long-consumed OTP codes (expired_at < now)
  const otpRes = await client.query(
    `DELETE FROM otp_codes 
     WHERE expires_at < now() 
        OR (consumed_at IS NOT NULL AND consumed_at < now() - interval '24 hours');`,
  );

  // 2. Prune expired or old revoked refresh tokens
  const refreshRes = await client.query(
    `DELETE FROM refresh_tokens 
     WHERE expires_at < now() 
        OR (revoked_at IS NOT NULL AND revoked_at < now() - interval '30 days');`,
  );

  // 3. Prune expired or used password reset tokens
  const resetRes = await client.query(
    `DELETE FROM admin_password_reset_tokens 
     WHERE expires_at < now() 
        OR (used_at IS NOT NULL AND used_at < now() - interval '24 hours');`,
  );

  const result: CleanupResult = {
    expiredOtpsDeleted: otpRes.rowCount || 0,
    expiredRefreshTokensDeleted: refreshRes.rowCount || 0,
    expiredResetTokensDeleted: resetRes.rowCount || 0,
  };

  logger.info(result, "Expired records cleanup job completed");
  return result;
}

// CLI entry point
const isDirectExecution =
  process.argv[1]?.endsWith("cleanup-expired.job.ts") ||
  process.argv[1]?.endsWith("cleanup-expired.job.js");

if (isDirectExecution) {
  cleanupExpiredRecords()
    .then((res) => {
      console.log("Cleanup completed:", res);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Cleanup failed:", err);
      process.exit(1);
    });
}
