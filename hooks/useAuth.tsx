"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { logActivity } from "@/app/lib/logger";

export type UserRole = "admin" | "staff" | "accountant" | "pending" | "owner";
export type AuthUser = { id?: string | number; name: string; email: string; role: UserRole };
type Credentials = { email: string; password: string; role?: UserRole };
type SignupData = { name: string; email: string; password: string };
type ProfilePatch = { name?: string; email?: string; id?: string | number };

type AuthContextValue = {
  user: AuthUser | null; isLoading: boolean; isAuthenticated: boolean;
  login: (data: Credentials) => Promise<AuthUser>;
  signup: (data: SignupData) => Promise<AuthUser>;
  logout: () => Promise<void>; refreshUser: () => Promise<void>;
  /** Display fields only — cannot change privileged `role` (use refreshUser after server updates). */
  updateUser: (patch: ProfilePatch) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? "";
const tokenKey = "almadel_access_token";
const userKey = "almadel_auth_user";
const businessKey = "almadel_active_business_id";
const TOKEN_EXPIRY_SKEW_SEC = 30;

function endpoint(path: string) {
  if (!backendUrl) throw new Error("BACKEND_URL is not configured.");
  return `${backendUrl}${path}`;
}

function getToken() {
  return typeof window === "undefined" ? null : localStorage.getItem(tokenKey);
}

function storeUser(user: AuthUser) {
  localStorage.setItem(userKey, JSON.stringify(user));
}

function clearAuthStorage() {
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(userKey);
  localStorage.removeItem(businessKey);
}

function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(atob(padded)) as { exp?: number };
  } catch {
    return null;
  }
}

/** Client-side pre-check; server `/auth/me` remains authoritative. */
function isAccessTokenExpired(token: string) {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  return Date.now() >= (payload.exp - TOKEN_EXPIRY_SKEW_SEC) * 1000;
}

async function parseResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.detail || data.error || "Something went wrong. Please try again.");
  return data;
}

function normalizeUser(data: Record<string, unknown>): AuthUser {
  const source = (data.user || data.data || data) as Record<string, unknown>;
  const rawRole = String(source.role || "staff").toLowerCase();
  let role: UserRole = "staff";
  if (rawRole === "admin") role = "admin";
  else if (rawRole === "accountant") role = "accountant";
  else if (rawRole === "pending") role = "pending";
  else if (rawRole === "owner") role = "owner";

  return {
    id: source.id as string | number | undefined,
    name: String(source.name || source.full_name || source.fullName || "Team member"),
    email: String(source.email || ""),
    role,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const sessionInvalid = useCallback(() => {
    clearAuthStorage();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    if (isAccessTokenExpired(token)) {
      sessionInvalid();
      setIsLoading(false);
      return;
    }

    try {
      const data = await parseResponse(
        await fetch(endpoint("/auth/me"), {
          method: "GET",
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      const nextUser = normalizeUser(data);
      storeUser(nextUser);
      setUser(nextUser);
    } catch {
      sessionInvalid();
    } finally {
      setIsLoading(false);
    }
  }, [sessionInvalid]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (credentials: Credentials) => {
    const data = await parseResponse(await fetch(endpoint("/auth/sign-in"), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(credentials),
    }));
    const token = data.access_token || data.accessToken || data.token;
    if (token) localStorage.setItem(tokenKey, String(token));
    const nextUser = normalizeUser(data);
    storeUser(nextUser);
    setUser(nextUser);

    logActivity(
      "AUTH_LOGIN",
      "Auth",
      `User ${nextUser.name} (${nextUser.email}) signed in`,
      "/login",
    );

    return nextUser;
  }, []);

  const signup = useCallback(async (details: SignupData) => {
    const data = await parseResponse(await fetch(endpoint("/auth/staff/sign-up"), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: details.name, email: details.email, password: details.password }),
    }));
    const token = data.access_token || data.accessToken || data.token;
    if (token) localStorage.setItem(tokenKey, String(token));
    const nextUser = normalizeUser(data);
    storeUser(nextUser);
    setUser(nextUser);

    logActivity(
      "AUTH_SIGNUP",
      "Auth",
      `New staff member registered: ${nextUser.name} (${nextUser.email})`,
      "/signup",
    );

    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    const current = user;
    if (current) {
      logActivity(
        "AUTH_LOGOUT",
        "Auth",
        `User ${current.name} (${current.email}) signed out`,
        "/login",
      );
    }
    sessionInvalid();
  }, [sessionInvalid, user]);

  const updateUser = useCallback((patch: ProfilePatch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next: AuthUser = {
        ...prev,
        ...(patch.id !== undefined ? { id: patch.id } : {}),
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
      };
      storeUser(next);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ user, isLoading, isAuthenticated: Boolean(user), login, signup, logout, refreshUser, updateUser }), [user, isLoading, login, signup, logout, refreshUser, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
