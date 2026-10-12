import { env } from "../../config/env.js";
import type { ISmsSender } from "./sms-sender.interface.js";

export interface SentSmsRecord {
  destination: string;
  code: string;
  timestamp: Date;
}

export class ConsoleSmsSender implements ISmsSender {
  private sentMessages: SentSmsRecord[] = [];

  async sendOtp(destination: string, code: string): Promise<void> {
    this.sentMessages.push({
      destination,
      code,
      timestamp: new Date(),
    });

    if (env.NODE_ENV !== "production") {
      console.log("\n============================================================");
      console.log("[DEV SMS] Dispatched OTP (Simulated):");
      console.log(`To:   ${destination}`);
      console.log(`Code: ${code}`);
      console.log("============================================================\n");
    }
  }

  getLastSent(destination?: string): SentSmsRecord | undefined {
    if (destination) {
      for (let i = this.sentMessages.length - 1; i >= 0; i--) {
        if (this.sentMessages[i].destination === destination) {
          return this.sentMessages[i];
        }
      }
      return undefined;
    }
    return this.sentMessages[this.sentMessages.length - 1];
  }

  clearHistory(): void {
    this.sentMessages = [];
  }
}
