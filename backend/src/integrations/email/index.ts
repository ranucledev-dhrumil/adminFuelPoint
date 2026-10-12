import { env } from "../../config/env.js";
import type { IEmailSender } from "./email-sender.interface.js";
import { NodemailerGmailSender } from "./nodemailer-gmail.js";
import { DevEmailLogger } from "./dev-email-logger.js";

export * from "./email-sender.interface.js";
export * from "./nodemailer-gmail.js";
export * from "./dev-email-logger.js";

class CompositeEmailSender implements IEmailSender {
  private nodemailer = new NodemailerGmailSender();
  private devLogger = new DevEmailLogger();

  async sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
    if (env.NODE_ENV !== "production") {
      await this.devLogger.sendPasswordResetEmail(to, name, token);
      if (env.SMTP_USER && env.SMTP_PASSWORD) {
        try {
          await this.nodemailer.sendPasswordResetEmail(to, name, token);
        } catch {
          // In development, do not fail the request if local SMTP network fails
        }
      }
    } else {
      await this.nodemailer.sendPasswordResetEmail(to, name, token);
    }
  }
}

export const emailSender: IEmailSender = new CompositeEmailSender();
