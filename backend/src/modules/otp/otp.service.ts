import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";
import { withTransaction } from "../../db/transaction.js";
import {
  otpRepository,
  type OtpActorType,
  type OtpChannel,
  type OtpPurpose,
  type OtpCodeRow,
} from "./otp.repository.js";
import { customerRepository } from "../customers/customer.repository.js";
import { workerRepository } from "../workers/worker.repository.js";
import { authRepository } from "../auth/auth.repository.js";
import { notificationService } from "../notifications/notification.service.js";
import { smsSender } from "../../integrations/sms/index.js";
import { normalizeIndianPhone } from "../../common/utils/phone.js";
import {
  hashSha256,
  generateOtp,
  generateOpaqueToken,
  signAccessToken,
} from "../../common/utils/crypto.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from "../../common/errors/app-error.js";

export interface RequestOtpDTO {
  destination: string;
  purpose: OtpPurpose;
  channel?: OtpChannel;
  actor_type?: OtpActorType;
}

export interface VerifyLoginOtpDTO {
  destination: string;
  code: string;
  actor_type: OtpActorType;
}

export interface LoginVerifyResult {
  accessToken: string;
  refreshToken: string;
  actor: {
    id: string;
    role: OtpActorType;
    name: string;
  };
}

export class OtpService {
  async requestOtp(dto: RequestOtpDTO, ip: string): Promise<{ message: string; cooldown: number }> {
    const channel: OtpChannel = dto.channel ?? "sms";
    if (channel !== "sms") {
      throw new BadRequestError(
        "Only 'sms' channel is currently supported for OTP.",
        "UNSUPPORTED_CHANNEL",
      );
    }

    const normalizedPhone = normalizeIndianPhone(dto.destination);
    if (!normalizedPhone) {
      throw new ValidationError("Invalid phone number format.", "INVALID_PHONE", [
        { field: "destination", issue: "Must be a valid 10-digit Indian mobile number." },
      ]);
    }

    if (dto.purpose === "register") {
      // 1. Check if phone is already registered for an existing customer
      const existingCustomer = await customerRepository.findByPhone(normalizedPhone);
      if (existingCustomer) {
        throw new ConflictError(
          "Phone number is already registered for an existing customer.",
          "PHONE_ALREADY_EXISTS",
        );
      }

      // 2. Check per-IP hourly rate limit (max 10 registration OTPs/hour)
      const ipHourlyCount = await otpRepository.countHourlyRegistrationOtpsForIp(ip);
      if (ipHourlyCount >= env.OTP_MAX_PER_HOUR_IP) {
        throw new TooManyRequestsError(
          "Too many registration OTP requests from this IP address. Please try again later.",
          "IP_HOURLY_LIMIT_EXCEEDED",
        );
      }

      // 3. Check per-destination hourly rate limit (max 5 OTPs/hour)
      const destHourlyCount = await otpRepository.countHourlyOtpsForDestination(
        normalizedPhone,
        channel,
      );
      if (destHourlyCount >= env.OTP_MAX_PER_HOUR_DESTINATION) {
        throw new TooManyRequestsError(
          "Too many OTP requests for this phone number. Please try again later.",
          "HOURLY_LIMIT_EXCEEDED",
        );
      }

      // 4. Check 60-second cooldown per destination
      const lastSent = await otpRepository.getRecentOtpForDestination(normalizedPhone, channel);
      if (lastSent) {
        const elapsedSec = (Date.now() - new Date(lastSent).getTime()) / 1000;
        if (elapsedSec < env.OTP_RESEND_COOLDOWN_SECONDS) {
          throw new TooManyRequestsError(
            `Please wait ${Math.ceil(env.OTP_RESEND_COOLDOWN_SECONDS - elapsedSec)} seconds before requesting a new code.`,
            "COOLDOWN_ACTIVE",
          );
        }
      }

      // 5. Generate and store OTP
      const code = generateOtp();
      const codeHash = hashSha256(code);
      const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

      await otpRepository.create({
        channel,
        destination: normalizedPhone,
        actorType: null,
        actorId: null,
        codeHash,
        purpose: "register",
        requestIp: ip,
        expiresAt,
      });

      // 6. Send SMS
      await smsSender.sendOtp(normalizedPhone, code);

      return {
        message: "Code sent",
        cooldown: env.OTP_RESEND_COOLDOWN_SECONDS,
      };
    }

    if (dto.purpose === "login") {
      const actorType = dto.actor_type;
      if (!actorType || (actorType !== "customer" && actorType !== "worker")) {
        throw new BadRequestError(
          "actor_type ('customer' or 'worker') is required for login OTP.",
          "INVALID_ACTOR_TYPE",
        );
      }

      // Look up actor
      let actorId: string | null = null;
      let isAllowed = false;

      if (actorType === "customer") {
        const customer = await customerRepository.findByPhone(normalizedPhone);
        if (customer && !customer.deleted_at) {
          actorId = customer.id;
          isAllowed = true;
        }
      } else if (actorType === "worker") {
        const worker = await workerRepository.findByPhone(normalizedPhone);
        if (worker && !worker.deleted_at) {
          actorId = worker.id;
          isAllowed = true;
        }
      }

      // TIMING-SAFE UNKNOWN PHONE RULE (D52):
      // If phone is not found, store NO row, send NO SMS, and return identical 200 payload
      if (!actorId || !isAllowed) {
        return {
          message: "Code sent",
          cooldown: env.OTP_RESEND_COOLDOWN_SECONDS,
        };
      }

      // Check per-destination hourly rate limit (max 5 OTPs/hour)
      const destHourlyCount = await otpRepository.countHourlyOtpsForDestination(
        normalizedPhone,
        channel,
      );
      if (destHourlyCount >= env.OTP_MAX_PER_HOUR_DESTINATION) {
        throw new TooManyRequestsError(
          "Too many OTP requests for this phone number. Please try again later.",
          "HOURLY_LIMIT_EXCEEDED",
        );
      }

      // Check 60-second cooldown per destination
      const lastSent = await otpRepository.getRecentOtpForDestination(normalizedPhone, channel);
      if (lastSent) {
        const elapsedSec = (Date.now() - new Date(lastSent).getTime()) / 1000;
        if (elapsedSec < env.OTP_RESEND_COOLDOWN_SECONDS) {
          throw new TooManyRequestsError(
            `Please wait ${Math.ceil(env.OTP_RESEND_COOLDOWN_SECONDS - elapsedSec)} seconds before requesting a new code.`,
            "COOLDOWN_ACTIVE",
          );
        }
      }

      // Generate and store OTP
      const code = generateOtp();
      const codeHash = hashSha256(code);
      const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

      await otpRepository.create({
        channel,
        destination: normalizedPhone,
        actorType,
        actorId,
        codeHash,
        purpose: "login",
        requestIp: ip,
        expiresAt,
      });

      // Send SMS
      await smsSender.sendOtp(normalizedPhone, code);

      return {
        message: "Code sent",
        cooldown: env.OTP_RESEND_COOLDOWN_SECONDS,
      };
    }

    throw new BadRequestError("Unsupported OTP purpose.", "INVALID_PURPOSE");
  }

  async verifyLoginOtp(
    dto: VerifyLoginOtpDTO,
    ip?: string,
    userAgent?: string,
  ): Promise<LoginVerifyResult> {
    const normalizedPhone = normalizeIndianPhone(dto.destination);
    if (!normalizedPhone) {
      throw new BadRequestError("Invalid phone number format.", "INVALID_PHONE");
    }

    const otpRow = await otpRepository.getLatestUnconsumed(
      normalizedPhone,
      "login",
      dto.actor_type,
    );

    if (!otpRow) {
      throw new BadRequestError("Invalid or expired OTP code.", "INVALID_OTP");
    }

    if (new Date(otpRow.expires_at).getTime() < Date.now()) {
      throw new BadRequestError("OTP code has expired.", "OTP_EXPIRED");
    }

    if (otpRow.attempts >= env.OTP_MAX_ATTEMPTS) {
      throw new BadRequestError(
        "Maximum OTP verification attempts exceeded.",
        "MAX_ATTEMPTS_EXCEEDED",
      );
    }

    const providedHash = hashSha256(dto.code);
    if (providedHash !== otpRow.code_hash) {
      await otpRepository.incrementAttempts(otpRow.id);
      throw new UnauthorizedError("Invalid OTP code.", "INVALID_OTP");
    }

    // Code matches -> mark consumed
    await otpRepository.markConsumed(otpRow.id);

    // Actor checks & token issuance
    if (dto.actor_type === "customer") {
      const customer = await customerRepository.findById(otpRow.actor_id!);
      if (!customer || customer.deleted_at) {
        throw new UnauthorizedError("Customer account not found.", "CUSTOMER_NOT_FOUND");
      }

      if (customer.status !== "active") {
        throw new ForbiddenError("Customer account is inactive.", "CUSTOMER_INACTIVE");
      }

      const rawRefreshToken = generateOpaqueToken(32);
      const tokenHash = hashSha256(rawRefreshToken);
      const expiresAt = new Date(
        Date.now() + env.USER_REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      );

      await authRepository.createRefreshToken({
        tokenHash,
        customerId: customer.id,
        expiresAt,
        ipAddress: ip,
        userAgent,
      });

      const accessToken = signAccessToken({
        sub: customer.id,
        role: "customer",
        aud: "fuelpoint-customer",
      });

      return {
        accessToken,
        refreshToken: rawRefreshToken,
        actor: {
          id: customer.id,
          role: "customer",
          name: customer.name,
        },
      };
    }

    if (dto.actor_type === "worker") {
      const worker = await workerRepository.findById(otpRow.actor_id!);
      if (!worker || worker.deleted_at) {
        throw new UnauthorizedError("Worker account not found.", "WORKER_NOT_FOUND");
      }

      if (worker.status !== "active") {
        if (worker.status === "offline") {
          throw new ForbiddenError("Worker is currently offline.", "WORKER_NOT_ACTIVE");
        }
        if (worker.status === "suspended") {
          throw new ForbiddenError("Worker account is suspended.", "WORKER_SUSPENDED");
        }
        throw new ForbiddenError("Worker is not active.", "WORKER_NOT_ACTIVE");
      }

      // Worker first login rule:
      // If first_login_at is null, atomically set it and create the worker notification
      if (!worker.first_login_at) {
        await withTransaction(pool, async (client) => {
          const fresh = await workerRepository.findByIdForUpdate(worker.id, client);
          if (fresh && !fresh.first_login_at) {
            await client.query("UPDATE workers SET first_login_at = now() WHERE id = $1", [
              worker.id,
            ]);
            await notificationService.notifyWorkerFirstLogin(worker.id, worker.name, client);
          }
        });
      }

      const rawRefreshToken = generateOpaqueToken(32);
      const tokenHash = hashSha256(rawRefreshToken);
      const expiresAt = new Date(
        Date.now() + env.USER_REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      );

      await authRepository.createRefreshToken({
        tokenHash,
        workerId: worker.id,
        expiresAt,
        ipAddress: ip,
        userAgent,
      });

      const accessToken = signAccessToken({
        sub: worker.id,
        role: "worker",
        aud: "fuelpoint-worker",
      });

      return {
        accessToken,
        refreshToken: rawRefreshToken,
        actor: {
          id: worker.id,
          role: "worker",
          name: worker.name,
        },
      };
    }

    throw new BadRequestError("Unsupported actor type.", "INVALID_ACTOR_TYPE");
  }

  async verifyRegisterOtp(destination: string, code: string): Promise<OtpCodeRow> {
    const normalizedPhone = normalizeIndianPhone(destination);
    if (!normalizedPhone) {
      throw new BadRequestError("Invalid phone number format.", "INVALID_PHONE");
    }

    const otpRow = await otpRepository.getLatestUnconsumed(normalizedPhone, "register");
    if (!otpRow) {
      throw new BadRequestError("Invalid or expired registration OTP code.", "INVALID_OTP");
    }

    if (new Date(otpRow.expires_at).getTime() < Date.now()) {
      throw new BadRequestError("Registration OTP has expired.", "OTP_EXPIRED");
    }

    if (otpRow.attempts >= env.OTP_MAX_ATTEMPTS) {
      throw new BadRequestError(
        "Maximum OTP verification attempts exceeded.",
        "MAX_ATTEMPTS_EXCEEDED",
      );
    }

    const providedHash = hashSha256(code);
    if (providedHash !== otpRow.code_hash) {
      await otpRepository.incrementAttempts(otpRow.id);
      throw new BadRequestError("Invalid OTP code.", "INVALID_OTP");
    }

    return otpRow;
  }
}

export const otpService = new OtpService();
