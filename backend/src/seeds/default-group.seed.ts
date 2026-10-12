import type pg from "pg";
import { pool } from "../db/pool.js";
import { logger } from "../common/utils/logger.js";

export const DEFAULT_GROUP_ID = "00000000-0000-0000-0000-000000000001";

export async function seedDefaultGroup(client: pg.Pool | pg.PoolClient = pool): Promise<void> {
  const query = `
    INSERT INTO groups (id, name, discount_percent, description, active, is_default)
    VALUES ($1, 'Standard (Default)', 0.00, 'Default group for newly registered customers', TRUE, TRUE)
    ON CONFLICT (is_default) WHERE is_default = TRUE AND deleted_at IS NULL
    DO NOTHING
    RETURNING id, name;
  `;

  const result = await client.query(query, [DEFAULT_GROUP_ID]);
  if (result.rowCount && result.rowCount > 0) {
    logger.info({ groupId: DEFAULT_GROUP_ID }, "Seeded default group successfully");
  } else {
    logger.info("Default group already exists, skipping.");
  }
}
