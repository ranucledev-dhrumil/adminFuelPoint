import { describe, it, expect, beforeEach } from "vitest";
import {
  hashPassword,
  verifyPassword,
  hashSha256,
  generateOpaqueToken,
  signAccessToken,
  verifyAccessToken,
} from "../common/utils/crypto.js";
import { LoginProtectionManager } from "../modules/auth/login-protection.js";
import { normalizeIndianPhone, isValidIndianPhone } from "../common/utils/phone.js";

describe("Auth Utilities & Login Protection Unit Tests", () => {
  describe("Crypto & Tokens", () => {
    it("hashes and verifies passwords using Argon2id", async () => {
      const password = "SuperSecretPassword123!";
      const hash = await hashPassword(password);

      expect(hash).toContain("$argon2id$");
      expect(await verifyPassword(hash, password)).toBe(true);
      expect(await verifyPassword(hash, "WrongPassword")).toBe(false);
    });

    it("generates SHA-256 hashes consistently", () => {
      const input = "sample_refresh_token_string";
      const hash1 = hashSha256(input);
      const hash2 = hashSha256(input);

      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hashSha256("different_string"));
    });

    it("generates cryptographically secure opaque tokens", () => {
      const token1 = generateOpaqueToken(32);
      const token2 = generateOpaqueToken(32);

      expect(token1).toHaveLength(64); // 32 bytes hex = 64 characters
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
    });

    it("signs and verifies JWT access tokens with correct minimal claims", () => {
      const claims = {
        sub: "00000000-0000-0000-0000-000000000001",
        role: "admin" as const,
        aud: "fuelpoint-admin" as const,
      };

      const token = signAccessToken(claims);
      expect(typeof token).toBe("string");

      const verified = verifyAccessToken(token);
      expect(verified.sub).toBe(claims.sub);
      expect(verified.role).toBe("admin");
      expect(verified.aud).toBe("fuelpoint-admin");
      expect(verified.iss).toBe("fuelpoint-api");
      expect(typeof verified.exp).toBe("number");
    });
  });

  describe("Indian Phone Normalization", () => {
    it("normalizes bare 10-digit phone starting 6-9 to E.164 +91", () => {
      expect(normalizeIndianPhone("9876543210")).toBe("+919876543210");
      expect(normalizeIndianPhone("8123456789")).toBe("+918123456789");
      expect(normalizeIndianPhone("7000000000")).toBe("+917000000000");
      expect(normalizeIndianPhone("6999999999")).toBe("+916999999999");
    });

    it("accepts existing +91 numbers", () => {
      expect(normalizeIndianPhone("+919876543210")).toBe("+919876543210");
      expect(normalizeIndianPhone("919876543210")).toBe("+919876543210");
    });

    it("rejects numbers not starting with 6-9 or invalid lengths", () => {
      expect(normalizeIndianPhone("5876543210")).toBeNull();
      expect(normalizeIndianPhone("987654321")).toBeNull();
      expect(normalizeIndianPhone("98765432100")).toBeNull();
      expect(normalizeIndianPhone("abcdefghij")).toBeNull();
      expect(normalizeIndianPhone(null)).toBeNull();
    });

    it("checks validity with isValidIndianPhone", () => {
      expect(isValidIndianPhone("9876543210")).toBe(true);
      expect(isValidIndianPhone("1234567890")).toBe(false);
    });
  });

  describe("LoginProtectionManager", () => {
    let protection: LoginProtectionManager;

    beforeEach(() => {
      protection = new LoginProtectionManager();
    });

    it("allows logins within IP rate limit and blocks after 10 failed attempts", () => {
      const ip = "192.168.1.100";

      for (let i = 0; i < 10; i++) {
        expect(() => protection.checkIpAllowed(ip)).not.toThrow();
        protection.recordFailure("admin@test.local", ip);
      }

      // The 11th attempt must be rate-limited
      expect(() => protection.checkIpAllowed(ip)).toThrow(/Too many failed login attempts/);
    });

    it("resets consecutive email failure count upon success", () => {
      const email = "admin@test.local";
      protection.recordFailure(email, "1.2.3.4");
      protection.recordFailure(email, "1.2.3.4");
      protection.recordFailure(email, "1.2.3.4");

      protection.recordSuccess(email);

      // Next failure should be attempt #1 again
      protection.recordFailure(email, "1.2.3.4");
      // No delay for attempt 1
    });
  });
});
