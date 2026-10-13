import crypto from "node:crypto";
import * as argon2 from "@node-rs/argon2";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import type { AccessTokenClaims, ActorRole, AudienceType } from "../types/common.js";

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export function hashSha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function generateOpaqueToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString("hex");
}

export function generateQrToken(): string {
  // 192 bits (24 bytes) of secure randomness encoded in URL-safe base64 (32 chars)
  return crypto.randomBytes(24).toString("base64url");
}

export function generateOtp(): string {
  // Cryptographically secure 6-digit numeric code (100000 to 999999)
  return crypto.randomInt(100000, 1000000).toString();
}

export function signAccessToken(payload: {
  sub: string;
  role: ActorRole;
  aud: AudienceType;
}): string {
  const claims: AccessTokenClaims = {
    sub: payload.sub,
    role: payload.role,
    aud: payload.aud,
    iss: "fuelpoint-api",
  };

  return jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: "fuelpoint-api",
  }) as AccessTokenClaims;

  return decoded;
}

export interface ScanTicketPayload {
  customerId: string;
  groupId: string;
  discountPercent: string;
}

export function signScanTicket(payload: ScanTicketPayload): string {
  return jwt.sign(
    {
      customerId: payload.customerId,
      groupId: payload.groupId,
      discountPercent: payload.discountPercent,
      ticketType: "scan",
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: "5m", // 5 minutes validity
      issuer: "fuelpoint-api",
    },
  );
}

export function verifyScanTicket(ticket: string): ScanTicketPayload {
  const decoded = jwt.verify(ticket, env.JWT_ACCESS_SECRET, {
    issuer: "fuelpoint-api",
  }) as jwt.JwtPayload & ScanTicketPayload & { ticketType?: string };

  if (
    decoded.ticketType !== "scan" ||
    !decoded.customerId ||
    !decoded.groupId ||
    decoded.discountPercent === undefined
  ) {
    throw new Error("Invalid scan ticket payload");
  }

  return {
    customerId: decoded.customerId,
    groupId: decoded.groupId,
    discountPercent: decoded.discountPercent,
  };
}
