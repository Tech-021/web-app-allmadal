import type { NavRole } from "@/app/lib/access";

export type NavLink = {
  href: string;
  label: string;
  key: string;
  icon: string;
  allowedRoles: NavRole[];
  subItems?: Array<{ href: string; label: string; key?: string; allowedRoles?: NavRole[] }>;
};

export const posLinks: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", key: "nav.dashboard", icon: "📊", allowedRoles: ["admin", "staff", "accountant"] },
  { href: "/sales", label: "Sales", key: "nav.sales", icon: "🛒", allowedRoles: ["admin", "staff"] },
  {
    href: "/products",
    label: "Products / Inventory",
    key: "nav.products_inventory",
    icon: "📦",
    allowedRoles: ["admin", "staff"],
    subItems: [
      { href: "/products", label: "All Products", key: "nav.all_products" },
      { href: "/categories", label: "Categories", key: "nav.categories" },
      { href: "/stock", label: "Stock Levels", key: "nav.stock_levels", allowedRoles: ["admin"] },
    ],
  },
  { href: "/payments", label: "Payments / Billing", key: "nav.payments", icon: "💳", allowedRoles: ["admin", "accountant"] },
  { href: "/staff", label: "Staff & Permissions", key: "nav.staff", icon: "👥", allowedRoles: ["admin"] },
  { href: "/logs", label: "Activity Logs", key: "nav.logs", icon: "📋", allowedRoles: ["admin"] },
  { href: "/settings", label: "Settings", key: "nav.settings", icon: "⚙️", allowedRoles: ["admin"] },
];

export const financialLinks: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", key: "nav.dashboard", icon: "📊", allowedRoles: ["admin", "staff", "accountant"] },
  { href: "/sales", label: "Sales", key: "nav.sales", icon: "🛒", allowedRoles: ["admin", "staff"] },
  {
    href: "/products",
    label: "Products / Inventory",
    key: "nav.products_inventory",
    icon: "📦",
    allowedRoles: ["admin", "staff"],
    subItems: [
      { href: "/products", label: "All Products", key: "nav.all_products" },
      { href: "/categories", label: "Categories", key: "nav.categories" },
      { href: "/stock", label: "Stock Levels", key: "nav.stock_levels", allowedRoles: ["admin"] },
    ],
  },
  { href: "/accounts", label: "Cash / Accounts", key: "nav.accounts", icon: "💵", allowedRoles: ["admin", "accountant"] },
  { href: "/customers", label: "Customers / Khata", key: "nav.customers", icon: "👥", allowedRoles: ["admin", "accountant"] },
  { href: "/suppliers", label: "Suppliers", key: "nav.suppliers", icon: "🏢", allowedRoles: ["admin", "accountant"] },
  { href: "/expenses", label: "Expenses", key: "nav.expenses", icon: "💸", allowedRoles: ["admin", "accountant"] },
  { href: "/imei", label: "IMEI Management", key: "nav.imei", icon: "📱", allowedRoles: ["admin"] },
  { href: "/payments", label: "Payments / Billing", key: "nav.payments", icon: "💳", allowedRoles: ["admin", "accountant"] },
  { href: "/invoices", label: "Invoices / Receipts", key: "nav.invoices", icon: "🧾", allowedRoles: ["admin", "accountant"] },
  { href: "/daily-closing", label: "Daily Closing", key: "nav.daily_closing", icon: "🔒", allowedRoles: ["admin", "accountant"] },
  { href: "/reports", label: "Reports & Balance Sheet", key: "nav.reports", icon: "📈", allowedRoles: ["admin", "accountant"] },
  { href: "/staff", label: "Staff & Permissions", key: "nav.staff", icon: "👤", allowedRoles: ["admin"] },
  { href: "/logs", label: "Activity Logs", key: "nav.logs", icon: "📋", allowedRoles: ["admin"] },
  { href: "/settings", label: "Settings", key: "nav.settings", icon: "⚙️", allowedRoles: ["admin"] },
];

/** Paths reachable without being listed in sidebar (onboarding, etc.). */
export const AUTHENTICATED_ROUTE_EXTRAS = ["/setup-business"] as const;

export function pathsAllowedForNavRole(links: NavLink[], role: NavRole): string[] {
  const paths: string[] = [];
  for (const item of links) {
    if (!item.allowedRoles.includes(role)) continue;
    paths.push(item.href);
    for (const sub of item.subItems ?? []) {
      if (!sub.allowedRoles || sub.allowedRoles.includes(role)) {
        paths.push(sub.href);
      }
    }
  }
  return paths;
}

export function isPathAllowedForNavRole(
  pathname: string,
  links: NavLink[],
  role: NavRole,
  extras: readonly string[] = AUTHENTICATED_ROUTE_EXTRAS,
): boolean {
  const allowed = [...pathsAllowedForNavRole(links, role), ...extras];
  return allowed.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function navRoleFallbackPath(role: NavRole): string {
  if (role === "accountant") return "/accounts";
  if (role === "staff") return "/sales";
  return "/dashboard";
}
