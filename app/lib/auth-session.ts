/** Shared auth storage keys and session teardown (401 / invalid token). */

export const tokenKey = "almadel_access_token";
export const userKey = "almadel_auth_user";
export const businessKey = "almadel_active_business_id";

const PUBLIC_AUTH_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password"];

export const SESSION_EXPIRED_EVENT = "almadel:session-expired";

export function clearAuthStorage() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(userKey);
  localStorage.removeItem(businessKey);
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
