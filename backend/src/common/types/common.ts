export type ActorRole = "admin" | "worker" | "customer";

export type AudienceType = "fuelpoint-admin" | "fuelpoint-worker" | "fuelpoint-customer";

export interface AccessTokenClaims {
  sub: string;
  role: ActorRole;
  aud: AudienceType;
  iss?: "fuelpoint-api";
  iat?: number;
  exp?: number;
}

export type AuthActor = AccessTokenClaims;

export interface AdminProfileResponse {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  location: string | null;
  initials: string;
  avatarUrl: string | null;
  joinedAt: Date | string;
  lastLoginAt: Date | string | null;
}
