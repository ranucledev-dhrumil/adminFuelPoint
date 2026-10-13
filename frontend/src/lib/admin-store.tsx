import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi, onAuthFailure } from "@/lib/api-client";
import type { AdminProfile } from "@/services/types";

export interface AdminState {
  authReady: boolean;
  authed: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  profile: AdminProfile;
  updateProfile: (patch: Partial<AdminProfile>) => void;
  setProfile: React.Dispatch<React.SetStateAction<AdminProfile>>;
}

const defaultProfile: AdminProfile = {
  name: "Administrator",
  email: "admin@fuelpoint.local",
  phone: "",
  role: "admin",
  location: "Main Station",
  joinedAt: new Date().toISOString(),
  initials: "AD",
};

const AdminContext = createContext<AdminState | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [profile, setProfile] = useState<AdminProfile>(defaultProfile);

  // Restore session via httpOnly cookie on mount
  useEffect(() => {
    let mounted = true;

    async function initSession() {
      try {
        const token = await authApi.refresh();
        if (token && mounted) {
          const prof = await authApi.getProfile();
          if (mounted && prof) {
            setProfile(prof);
            setAuthed(true);
          }
        }
      } catch {
        // Not authenticated
      } finally {
        if (mounted) {
          setAuthReady(true);
        }
      }
    }

    initSession();

    const unsubscribe = onAuthFailure(() => {
      if (mounted) {
        setAuthed(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setProfile(res.admin);
    setAuthed(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setAuthed(false);
    }
  }, []);

  const updateProfile = useCallback((patch: Partial<AdminProfile>) => {
    setProfile((prev) => ({ ...prev, ...patch }));
  }, []);

  const value: AdminState = {
    authReady,
    authed,
    login,
    logout,
    profile,
    updateProfile,
    setProfile,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside AdminProvider");
  return ctx;
}
