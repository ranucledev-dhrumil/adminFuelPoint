import { RateLimitError } from "../../common/errors/app-error.js";

interface FailedIpRecord {
  timestamps: number[];
}

export class LoginProtectionManager {
  private failedByIp = new Map<string, FailedIpRecord>();
  private failedByEmail = new Map<string, number>();

  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_FAILED_PER_IP = 10;

  checkIpAllowed(ip: string): void {
    const now = Date.now();
    const record = this.failedByIp.get(ip);
    if (!record) return;

    // Prune expired timestamps
    record.timestamps = record.timestamps.filter((ts) => now - ts < this.WINDOW_MS);
    if (record.timestamps.length >= this.MAX_FAILED_PER_IP) {
      throw new RateLimitError(
        "Too many failed login attempts from this IP. Please try again later.",
        "TOO_MANY_FAILED_LOGINS",
      );
    }
  }

  async applyProgressiveDelay(email: string): Promise<void> {
    const failures = this.failedByEmail.get(email.toLowerCase()) || 0;
    if (failures >= 5) {
      await new Promise((resolve) => setTimeout(resolve, 4000));
    } else if (failures === 4) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } else if (failures === 3) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  recordFailure(email: string, ip: string): void {
    const now = Date.now();
    const cleanEmail = email.toLowerCase();

    // Track email consecutive failures
    const current = this.failedByEmail.get(cleanEmail) || 0;
    this.failedByEmail.set(cleanEmail, current + 1);

    // Track IP failures
    let ipRecord = this.failedByIp.get(ip);
    if (!ipRecord) {
      ipRecord = { timestamps: [] };
      this.failedByIp.set(ip, ipRecord);
    }
    ipRecord.timestamps.push(now);
  }

  recordSuccess(email: string): void {
    this.failedByEmail.delete(email.toLowerCase());
  }

  reset(): void {
    this.failedByIp.clear();
    this.failedByEmail.clear();
  }
}

export const loginProtection = new LoginProtectionManager();
