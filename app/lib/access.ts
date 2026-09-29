import type { UserRole } from "@/hooks/useAuth";

/** Sidebar / route guard roles (subset of account types shown in the UI). */
export type NavRole = "admin" | "staff" | "accountant";

/**
 * UI permission role from **business membership** (API: `/business/my-businesses`).
 * Global `User.role` in localStorage is not used to grant admin/accountant nav access.
 */
export function effectiveNavRole(
  userRole: UserRole | undefined,
  membershipRole?: string | null,
): NavRole {
  const member = membershipRole?.toLowerCase();

  if (member === "owner" || member === "admin") {
    return "admin";
  }
  if (member === "accountant") {
    return "accountant";
  }
  if (member === "staff") {
    return "staff";
  }

  // No membership context yet (loading) or no business — least privilege.
  if (userRole === "pending") {
    return "staff";
  }

  return "staff";
}

export function canManageStore(membershipRole?: string | null): boolean {
  return membershipRole === "owner" || membershipRole === "admin";
}

/** Routes that belong to Financial workspace — not shown in POS nav; block direct URL access in POS mode. */
export const FINANCIAL_WORKSPACE_ROUTES = [
  "/accounts",
  "/customers",
  "/suppliers",
  "/expenses",
  "/imei",
  "/invoices",
  "/daily-closing",
  "/reports",
] as const;

export function isFinancialWorkspacePath(pathname: string): boolean {
  return FINANCIAL_WORKSPACE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/** Account-level label only (from `/auth/me`); not used for route guards. */
export function accountRoleLabel(userRole: UserRole | undefined): string {
  if (userRole === "owner") return "owner";
  if (userRole === "accountant") return "accountant";
  if (userRole === "admin") return "platform admin";
  if (userRole === "pending") return "pending";
  return "staff";
}
