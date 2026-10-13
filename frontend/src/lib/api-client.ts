import type { AdminProfile } from "@/services/types";

// Base API URL from environment variable or fallback to local backend
export const API_BASE_URL =
  (import.meta.env["VITE_API_URL"] as string | undefined)?.replace(/\/+$/, "") ||
  "http://localhost:3000/api/v1";

/**
 * Structured API Error containing HTTP status, backend error code, message and optional validation details.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// In-memory access token storage (never stored in localStorage or sessionStorage)
let inMemoryAccessToken: string | null = null;

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

type AuthFailureListener = () => void;
const authFailureListeners = new Set<AuthFailureListener>();

export function onAuthFailure(listener: AuthFailureListener): () => void {
  authFailureListeners.add(listener);
  return () => {
    authFailureListeners.delete(listener);
  };
}

function notifyAuthFailure(): void {
  setAccessToken(null);
  authFailureListeners.forEach((fn) => fn());
}

// Mutex lock to serialize token refresh across concurrent requests
let refreshPromise: Promise<string | null> | null = null;

export async function refreshToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Send httpOnly refresh token cookie
      });

      if (!res.ok) {
        notifyAuthFailure();
        return null;
      }

      const data = (await res.json()) as { accessToken?: string };
      if (data.accessToken) {
        setAccessToken(data.accessToken);
        return data.accessToken;
      }

      notifyAuthFailure();
      return null;
    } catch {
      notifyAuthFailure();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Generic API request function with automatic JWT attachment, credentials inclusion,
 * 401 interception, silent token refresh, and request retry.
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: "include",
  };

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (netErr) {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      netErr instanceof Error ? netErr.message : "Network connection failed",
    );
  }

  // Intercept 401 if not an auth endpoint that handles its own credentials
  const isAuthEndpoint =
    endpoint.includes("/auth/admin/login") ||
    endpoint.includes("/auth/refresh") ||
    endpoint.includes("/auth/admin/forgot-password") ||
    endpoint.includes("/auth/admin/reset-password");

  if (response.status === 401 && !isAuthEndpoint) {
    const newToken = await refreshToken();
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      try {
        response = await fetch(url, { ...fetchOptions, headers });
      } catch (netErr) {
        throw new ApiError(
          0,
          "NETWORK_ERROR",
          netErr instanceof Error ? netErr.message : "Network connection failed on retry",
        );
      }
    }
  }

  if (!response.ok) {
    let errorData: { error?: { code?: string; message?: string; details?: unknown } } | null = null;
    try {
      errorData = await response.json();
    } catch {
      errorData = null;
    }

    const code =
      errorData?.error?.code ||
      (response.status === 401
        ? "UNAUTHORIZED"
        : response.status === 403
          ? "FORBIDDEN"
          : response.status === 404
            ? "NOT_FOUND"
            : response.status === 422
              ? "VALIDATION_ERROR"
              : "UNKNOWN_ERROR");

    const message =
      errorData?.error?.message ||
      response.statusText ||
      `Request failed with status ${response.status}`;
    const details = errorData?.error?.details || null;

    throw new ApiError(response.status, code, message, details);
  }

  if (response.status === 204) {
    return null as T;
  }

  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as unknown as T;
}

/**
 * Authentication service functions wrapping real API endpoints.
 */
export const authApi = {
  login: async (email: string, password: string) => {
    const res = await apiRequest<{ accessToken: string; admin: AdminProfile }>(
      "/auth/admin/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
    );
    setAccessToken(res.accessToken);
    return res;
  },

  logout: async () => {
    try {
      await apiRequest("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ allDevices: false }),
      });
    } finally {
      setAccessToken(null);
    }
  },

  forgotPassword: async (email: string) => {
    return apiRequest<{ message: string }>("/auth/admin/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  resetPassword: async (token: string, newPassword: string) => {
    return apiRequest<{ message: string }>("/auth/admin/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    });
  },

  refresh: async () => {
    return refreshToken();
  },

  getProfile: async () => {
    return apiRequest<AdminProfile>("/admin/profile");
  },
};

export async function apiRequestBlob(endpoint: string, options: RequestInit = {}): Promise<Blob> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const headers = new Headers(options.headers || {});
  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: "include",
  };

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (netErr) {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      netErr instanceof Error ? netErr.message : "Network connection failed",
    );
  }

  if (response.status === 401) {
    const newToken = await refreshToken();
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      try {
        response = await fetch(url, { ...fetchOptions, headers });
      } catch (netErr) {
        throw new ApiError(
          0,
          "NETWORK_ERROR",
          netErr instanceof Error ? netErr.message : "Network connection failed on retry",
        );
      }
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, "EXPORT_FAILED", "Failed to download file");
  }

  return response.blob();
}
