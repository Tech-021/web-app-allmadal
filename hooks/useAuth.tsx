"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type UserRole = "admin" | "staff";
export type AuthUser = { id?: string | number; name: string; email: string; role: UserRole };
type Credentials = { email: string; password: string; role: UserRole };
type SignupData = { name: string; email: string; password: string };
type AuthContextValue = {
  user: AuthUser | null; isLoading: boolean; isAuthenticated: boolean;
  login: (data: Credentials) => Promise<AuthUser>;
  signup: (data: SignupData) => Promise<AuthUser>;
  logout: () => Promise<void>; refreshUser: () => Promise<void>;
  updateUser: (user: AuthUser) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? "";
const tokenKey = "almadel_access_token";
const userKey = "almadel_auth_user";

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

function getStoredUser() {
  if (typeof window === "undefined") return null;

  try {
    const value = localStorage.getItem(userKey);
    return value ? (JSON.parse(value) as AuthUser) : null;
  } catch {
    localStorage.removeItem(userKey);
    return null;
  }
}

async function parseResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.detail || data.error || "Something went wrong. Please try again.");
  return data;
}

function normalizeUser(data: Record<string, unknown>): AuthUser {
  const source = (data.user || data.data || data) as Record<string, unknown>;
  return {
    id: source.id as string | number | undefined,
    name: String(source.name || source.full_name || source.fullName || "Team member"),
    email: String(source.email || ""),
    role: String(source.role || "staff").toLowerCase() === "admin" ? "admin" : "staff",
  };
}

import { logActivity } from "@/app/lib/logger";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (!token) { setUser(null); setIsLoading(false); return; }
    setUser(getStoredUser());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // The initial request hydrates the client-side auth state from the HTTP-only session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (credentials: Credentials) => {
    const data = await parseResponse(await fetch(endpoint("/auth/sign-in"), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(credentials),
    }));
    const token = data.access_token || data.accessToken || data.token;
    if (token) localStorage.setItem(tokenKey, String(token));
    const nextUser = normalizeUser(data);
    if (nextUser.role !== credentials.role) {
      localStorage.removeItem(tokenKey);
      throw new Error(`This account is registered as ${nextUser.role}, not ${credentials.role}.`);
    }
    storeUser(nextUser);
    setUser(nextUser);

    logActivity(
      "AUTH_LOGIN",
      "Auth",
      `User ${nextUser.name} (${nextUser.email}) signed in with ${nextUser.role} role`,
      "/login",
      { role: nextUser.role },
      { name: nextUser.name, email: nextUser.email, role: nextUser.role }
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
      { role: "staff" },
      { name: nextUser.name, email: nextUser.email, role: "staff" }
    );

    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    const current = getStoredUser();
    if (current) {
      logActivity(
        "AUTH_LOGOUT",
        "Auth",
        `User ${current.name} (${current.email}) signed out`,
        "/login",
        undefined,
        { name: current.name, email: current.email, role: current.role }
      );
    }
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    localStorage.removeItem("almadel_active_business_id");
    setUser(null);
  }, []);
  const updateUser = useCallback((nextUser: AuthUser) => { storeUser(nextUser); setUser(nextUser); }, []);
  const value = useMemo(() => ({ user, isLoading, isAuthenticated: Boolean(user), login, signup, logout, refreshUser, updateUser }), [user, isLoading, login, signup, logout, refreshUser, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
