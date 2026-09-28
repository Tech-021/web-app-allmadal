import type { UserRole } from "@/hooks/useAuth";

/** Sidebar / route guard roles (subset of account types shown in the UI). */
export type NavRole = "admin" | "staff" | "accountant";

/** Nav/UI permission role derived from business membership (not global User.role). */
export function effectiveNavRole(
  userRole: UserRole,
  membershipRole?: string | null,
): NavRole {
  if (membershipRole === "owner" || membershipRole === "admin") {
    return "admin";
  }
  if (userRole === "owner") {
    return "admin";
  }
  if (userRole === "pending") {
    return "staff";
  }
  if (userRole === "accountant" || membershipRole === "accountant") {
    return "accountant";
  }
  return "staff";
}

export function canManageStore(membershipRole?: string | null): boolean {
  return membershipRole === "owner" || membershipRole === "admin";
}
