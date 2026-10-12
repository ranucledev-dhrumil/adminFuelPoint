import { env } from "../../config/env.js";
import { logger } from "../../common/utils/logger.js";
import type { IEmailSender } from "./email-sender.interface.js";

export class DevEmailLogger implements IEmailSender {
  async sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
    const resetUrl = `${env.CORS_ORIGIN}/reset-password?token=${encodeURIComponent(token)}`;

    logger.info(
      {
        to,
        name,
        resetUrl,
      },
      "[DEV EMAIL] Password reset link generated",
    );

    // Also print clearly to stdout in development mode
    console.log("\n============================================================");
    console.log("[DEV] Password Reset Link (Simulated Email Dispatch):");
    console.log(`To:        ${to} (${name})`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log("Token:     " + token);
    console.log("============================================================\n");
  }
}
