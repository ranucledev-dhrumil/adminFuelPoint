import path from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";
import { pool } from "../db/pool.js";
import { seedDefaultGroup } from "./default-group.seed.js";
import { seedFirstAdmin } from "./first-admin.seed.js";
import { logger } from "../common/utils/logger.js";

export async function runSeeds(client: pg.Pool | pg.PoolClient = pool): Promise<void> {
  logger.info("Starting database seeding...");
  await seedDefaultGroup(client);
  await seedFirstAdmin(client);
  logger.info("Database seeding completed successfully.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runSeeds(pool)
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      logger.error({ err }, "Seeding failed");
      await pool.end();
      process.exit(1);
    });
}
