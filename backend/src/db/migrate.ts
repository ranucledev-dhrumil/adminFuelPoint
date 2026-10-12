import path from "node:path";
import { fileURLToPath } from "node:url";
import { runner, type RunnerOption } from "node-pg-migrate";
import { env } from "../config/env.js";
import { logger } from "../common/utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultMigrationsDir = path.resolve(__dirname, "../../migrations");

export interface MigrateOptions {
  databaseUrl?: string;
  database?: string;
  direction?: "up" | "down";
  count?: number;
  migrationsDir?: string;
}

export function buildDatabaseUrl(dbName = env.DB_NAME): string {
  const user = encodeURIComponent(env.DB_USER);
  const password = encodeURIComponent(env.DB_PASSWORD);
  return `postgres://${user}:${password}@${env.DB_HOST}:${env.DB_PORT}/${dbName}`;
}

export async function runMigrations(options: MigrateOptions = {}) {
  const direction = options.direction ?? "up";
  const dbUrl = options.databaseUrl ?? buildDatabaseUrl(options.database ?? env.DB_NAME);
  const dir = options.migrationsDir ?? defaultMigrationsDir;

  const runnerOptions: RunnerOption = {
    databaseUrl: dbUrl,
    dir,
    direction,
    count: options.count,
    migrationsTable: "pgmigrations",
    singleTransaction: true,
    checkOrder: true,
    advisoryLockMode: "wait",
    migrationLoaderStrategies: [
      {
        extensions: [".sql"],
        loader: "legacySql",
      },
    ],
  };

  logger.info(
    { direction, dir, dbUrl: dbUrl.replace(/:[^:@]+@/, ":***@") },
    "Running database migrations",
  );
  const result = await runner(runnerOptions);
  logger.info({ appliedCount: result.length }, "Database migrations completed successfully");
  return result;
}

// CLI execution handling
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const directionArg = process.argv[2] === "down" ? "down" : "up";
  const countArg = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;

  runMigrations({ direction: directionArg, count: countArg })
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, "Migration failed");
      process.exit(1);
    });
}
