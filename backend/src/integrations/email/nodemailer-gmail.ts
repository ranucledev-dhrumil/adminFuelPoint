import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env.js";
import { logger } from "../../common/utils/logger.js";
import type { IEmailSender } from "./email-sender.interface.js";

export class NodemailerGmailSender implements IEmailSender {
  private transporter: Transporter | null = null;

  constructor() {
    if (env.SMTP_USER && env.SMTP_PASSWORD) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASSWORD,
        },
      });
    }
  }

  async sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
    if (!this.transporter) {
      logger.warn({ to }, "Nodemailer Gmail sender called but SMTP credentials are not configured");
      return;
    }

    const resetUrl = `${env.CORS_ORIGIN}/reset-password?token=${encodeURIComponent(token)}`;

    const mailOptions = {
      from: env.EMAIL_FROM || env.SMTP_USER,
      to,
      subject: "FuelPoint — Admin Password Reset Request",
      text: `Hello ${name},\n\nA password reset request was initiated for your FuelPoint administrator account.\n\nPlease use the following link to reset your password (valid for 60 minutes):\n${resetUrl}\n\nIf you did not request this, please ignore this email.\n`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>Hello ${name},</p>
          <p>A password reset request was initiated for your FuelPoint administrator account.</p>
          <p style="margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Reset Password
            </a>
          </p>
          <p>This link is valid for 60 minutes.</p>
          <p style="color: #64748b; font-size: 13px;">If you did not request this, please ignore this email.</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info({ to }, "Password reset email sent via Nodemailer");
    } catch (err) {
      logger.error({ err, to }, "Failed to send password reset email via Nodemailer");
      throw err;
    }
  }
}
