/** Shared auth storage keys and session teardown (401 / invalid token). */

export const tokenKey = "almadel_access_token";
export const userKey = "almadel_auth_user";
export const businessKey = "almadel_active_business_id";
/** Login preference: "1" = localStorage (remember), "0" = sessionStorage for next sign-in. */
export const rememberAuthKey = "almadel_remember_auth";

const AUTH_KEYS = [tokenKey, userKey, businessKey] as const;

const PUBLIC_AUTH_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/magic-link",
  "/auth/magic-link",
];

export const SESSION_EXPIRED_EVENT = "almadel:session-expired";

function authKeys() {
  return AUTH_KEYS;
}

/** Storage backing the current session (sessionStorage when "Remember me" is off). */
export function getActiveAuthStorage(): Storage {
  if (typeof window === "undefined") return localStorage;
  if (sessionStorage.getItem(tokenKey)) return sessionStorage;
  if (localStorage.getItem(tokenKey)) return localStorage;
  return localStorage.getItem(rememberAuthKey) === "0" ? sessionStorage : localStorage;
}

export function getAuthItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(key) ?? localStorage.getItem(key);
}

export function setAuthItem(key: string, value: string) {
  if (typeof window === "undefined") return;
  const primary = getActiveAuthStorage();
  const secondary = primary === localStorage ? sessionStorage : localStorage;
  primary.setItem(key, value);
  if (key !== rememberAuthKey) secondary.removeItem(key);
}

export function removeAuthItem(key: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}

export function setAuthPersistence(remember: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(rememberAuthKey, remember ? "1" : "0");
}

export function isRememberAuthPreferred(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(rememberAuthKey) !== "0";
}

/** Write token + user to the chosen persistence layer; clear duplicates in the other store. */
export function persistAuthCredentials(token: string, userJson: string, remember: boolean) {
  if (typeof window === "undefined") return;
  setAuthPersistence(remember);
  const primary = remember ? localStorage : sessionStorage;
  const secondary = remember ? sessionStorage : localStorage;
  for (const k of authKeys()) {
    secondary.removeItem(k);
  }
  primary.setItem(tokenKey, token);
  primary.setItem(userKey, userJson);
}

export function clearAuthStorage() {
  if (typeof window === "undefined") return;
  for (const k of authKeys()) {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  }
}

export function redirectToLoginAfterAuthFailure() {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (PUBLIC_AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return;
  const next = path && path !== "/" ? `?next=${encodeURIComponent(path + window.location.search)}` : "";
  window.location.assign(`/login${next}`);
}

/** Clear session and send user to login when the API rejects credentials (401). */
export function teardownSessionOnUnauthorized() {
  clearAuthStorage();
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  redirectToLoginAfterAuthFailure();
}

export function handleApiUnauthorizedStatus(status: number) {
  if (status !== 401 || typeof window === "undefined") return;
  teardownSessionOnUnauthorized();
}
