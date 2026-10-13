import { logger } from "../common/utils/logger.js";
import { cleanupExpiredRecords } from "./cleanup-expired.job.js";

export class JobScheduler {
  private timer: NodeJS.Timeout | null = null;
  private intervalMs: number;

  constructor(intervalMs: number = 60 * 60 * 1000) {
    // Default: run once every hour
    this.intervalMs = intervalMs;
  }

  start(): void {
    if (this.timer) return;

    logger.info({ intervalMs: this.intervalMs }, "Starting in-process background job scheduler");

    this.timer = setInterval(async () => {
      try {
        await cleanupExpiredRecords();
      } catch (err) {
        logger.error({ err }, "Background cleanup job failed");
      }
    }, this.intervalMs);

    // Ensure timer doesn't keep the event loop alive if all other handles close
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info("Stopped in-process background job scheduler");
    }
  }

  async runNow(): Promise<void> {
    await cleanupExpiredRecords();
  }
}

export const scheduler = new JobScheduler();
