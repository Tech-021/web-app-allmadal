"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  SESSION_EXPIRED_EVENT,
  businessKey,
  clearAuthStorage,
  ensureValidSessionOrRedirect,
  getAuthItem,
  isAccessTokenExpired,
  isIntentionalLogoutActive,
  markIntentionalLogout,
  persistAuthCredentials,
  redirectToLoginAfterAuthFailure,
  removeAuthItem,
  setAuthItem,
  teardownSessionOnUnauthorized,
  tokenKey,
  userKey,
} from "@/app/lib/auth-session";
import { logActivity } from "@/app/lib/logger";
import { signInWithPasskey } from "@/app/lib/passkey";

export type UserRole = "admin" | "staff" | "accountant" | "pending" | "owner";
export type AuthUser = { id?: string | number; name: string; email: string; role: UserRole };
type Credentials = { email: string; password: string; role?: UserRole; rememberMe?: boolean };
type SignupData = { name: string; email: string; password: string };
type ProfilePatch = { name?: string; email?: string; id?: string | number };

type AuthApiPayload = Record<string, unknown>;

type AuthContextValue = {
  user: AuthUser | null; isLoading: boolean; isAuthenticated: boolean;
  login: (data: Credentials) => Promise<AuthUser>;
  loginWithMagicLink: (token: string, options?: { rememberMe?: boolean }) => Promise<AuthUser>;
  loginWithPasskey: (email?: string, options?: { rememberMe?: boolean }) => Promise<AuthUser>;
  signup: (data: SignupData) => Promise<AuthUser>;
  logout: () => Promise<void>; refreshUser: () => Promise<void>;
  /** Display fields only — cannot change privileged `role` (use refreshUser after server updates). */
  updateUser: (patch: ProfilePatch) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? "";
function endpoint(path: string) {
  if (!backendUrl) throw new Error("BACKEND_URL is not configured.");
  return `${backendUrl}${path}`;
}

function getToken() {
  return getAuthItem(tokenKey);
}

function storeUser(user: AuthUser) {
  setAuthItem(userKey, JSON.stringify(user));
}

async function parseResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.detail || data.error || "Something went wrong. Please try again.");
  }
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
      redirectToLoginAfterAuthFailure();
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(endpoint("/auth/me"), {
        method: "GET",
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        teardownSessionOnUnauthorized();
        setUser(null);
        setIsLoading(false);
        return;
      }
      const data = await parseResponse(response);
      const nextUser = normalizeUser(data);
      storeUser(nextUser);
      setUser(nextUser);
    } catch {
      sessionInvalid();
      if (!isIntentionalLogoutActive()) {
        redirectToLoginAfterAuthFailure();
      }
    } finally {
      setIsLoading(false);
    }
  }, [sessionInvalid]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const onSessionExpired = () => {
      setUser(null);
      redirectToLoginAfterAuthFailure();
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
  }, []);

  useEffect(() => {
    const tick = () => {
      const token = getToken();
      if (!token) return;
      if (isAccessTokenExpired(token)) {
        teardownSessionOnUnauthorized();
        setUser(null);
      }
    };
    const interval = window.setInterval(tick, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const onApiActivity = () => {
      if (!ensureValidSessionOrRedirect()) setUser(null);
    };
    window.addEventListener("focus", onApiActivity);
    return () => window.removeEventListener("focus", onApiActivity);
  }, [user]);

  const applyAuthResponse = useCallback((data: AuthApiPayload, remember: boolean) => {
    const token = data.access_token || data.accessToken || data.token;
    const nextUser = normalizeUser(data);
    if (token) {
      persistAuthCredentials(String(token), JSON.stringify(nextUser), remember);
    } else {
      storeUser(nextUser);
    }
    const activeBusinessId = data.activeBusinessId;
    if (activeBusinessId != null && activeBusinessId !== "") {
      setAuthItem(businessKey, String(activeBusinessId));
    } else {
      removeAuthItem(businessKey);
    }
    setUser(nextUser);
    return nextUser;
  }, []);

  const login = useCallback(async (credentials: Credentials) => {
    const data = await parseResponse(await fetch(endpoint("/auth/sign-in"), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(credentials),
    }));
    const remember = credentials.rememberMe !== false;
    const nextUser = applyAuthResponse(data, remember);

    logActivity(
      "AUTH_LOGIN",
      "Auth",
      `User ${nextUser.name} (${nextUser.email}) signed in`,
      "/login",
    );

    return nextUser;
  }, [applyAuthResponse]);

  const loginWithMagicLink = useCallback(async (magicToken: string, options?: { rememberMe?: boolean }) => {
    const data = await parseResponse(await fetch(endpoint("/auth/magic-link/verify"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: magicToken.trim() }),
    }));
    const remember = options?.rememberMe !== false;
    const nextUser = applyAuthResponse(data, remember);

    logActivity(
      "AUTH_LOGIN",
      "Auth",
      `User ${nextUser.name} (${nextUser.email}) signed in via magic link`,
      "/auth/magic-link",
    );

    return nextUser;
  }, [applyAuthResponse]);

  const loginWithPasskey = useCallback(async (email?: string, options?: { rememberMe?: boolean }) => {
    const data = await signInWithPasskey(email);
    const remember = options?.rememberMe !== false;
    const nextUser = applyAuthResponse(data as AuthApiPayload, remember);

    logActivity(
      "AUTH_LOGIN",
      "Auth",
      `User ${nextUser.name} (${nextUser.email}) signed in via passkey`,
      "/login",
    );

    return nextUser;
  }, [applyAuthResponse]);

  const signup = useCallback(async (details: SignupData) => {
    const data = await parseResponse(await fetch(endpoint("/auth/staff/sign-up"), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: details.name, email: details.email, password: details.password }),
    }));
    const token = data.access_token || data.accessToken || data.token;
    const nextUser = normalizeUser(data);
    if (token) {
      persistAuthCredentials(String(token), JSON.stringify(nextUser), true);
    } else {
      storeUser(nextUser);
    }
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
    markIntentionalLogout();
    const current = user;
    if (current) {
      await logActivity(
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
  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      loginWithMagicLink,
      loginWithPasskey,
      signup,
      logout,
      refreshUser,
      updateUser,
    }),
    [user, isLoading, login, loginWithMagicLink, loginWithPasskey, signup, logout, refreshUser, updateUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
