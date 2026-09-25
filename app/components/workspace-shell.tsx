"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/app/components/business-context";
import { TrialExpiredModal } from "@/app/components/trial-expired-modal";
import styles from "./workspace-shell.module.css";
import { logActivity } from "@/app/lib/logger";
import { resolveImageUrl } from "@/app/lib/api";
import { useLanguage } from "./language-context";
import { LanguageSwitcher } from "./language-switcher";

type NavLink = {
  href: string;
  label: string;
  key: string;
  icon: string;
  allowedRoles: Array<"admin" | "staff" | "accountant">;
  subItems?: Array<{ href: string; label: string; key?: string; allowedRoles?: Array<"admin" | "staff" | "accountant"> }>;
};

const posLinks: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", key: "nav.dashboard", icon: "📊", allowedRoles: ["admin", "staff", "accountant"] },
  { href: "/sales", label: "Sales", key: "nav.sales", icon: "🛒", allowedRoles: ["admin", "staff"] },
  {
    href: "/products",
    label: "Products",
    key: "nav.products",
    icon: "📦",
    allowedRoles: ["admin", "staff"],
    subItems: [
      { href: "/products", label: "All Products", key: "nav.all_products" },
      { href: "/categories", label: "Categories", key: "nav.categories" },
    ],
  },
  { href: "/stock", label: "Stock", key: "nav.stock", icon: "📥", allowedRoles: ["admin"] },
  { href: "/customers", label: "Customers", key: "nav.customers", icon: "👥", allowedRoles: ["admin", "staff", "accountant"] },
  { href: "/accounts", label: "Cash / Accounts", key: "nav.accounts", icon: "💵", allowedRoles: ["admin", "accountant"] },
  { href: "/reports", label: "Reports & Balance Sheet", key: "nav.reports", icon: "📈", allowedRoles: ["admin", "accountant"] },
  { href: "/expenses", label: "Expenses", key: "nav.expenses", icon: "💸", allowedRoles: ["admin", "accountant"] },
  { href: "/payments", label: "Payments / Billing", key: "nav.payments", icon: "💳", allowedRoles: ["admin", "accountant"] },
  { href: "/staff", label: "Staff & Permissions", key: "nav.staff", icon: "👥", allowedRoles: ["admin"] },
  { href: "/logs", label: "Activity Logs", key: "nav.logs", icon: "📋", allowedRoles: ["admin"] },
  { href: "/settings", label: "Settings", key: "nav.settings", icon: "⚙️", allowedRoles: ["admin"] },
];

const financialLinks: NavLink[] = [
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

function ShoppingBagIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function StoreIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
      <path d="M2 7h20" />
      <path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7" />
    </svg>
  );
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading, logout } = useAuth();
  const { activeBusiness, workspaceMode } = useBusiness();
  const { language, t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const resolvedLogo = resolveImageUrl(activeBusiness?.logoUrl);

  const allLinks = workspaceMode === "pos" ? posLinks : financialLinks;
  
  // Filter links by user role and translate labels dynamically
  const accessibleLinks = useMemo(() => {
    if (!user) return [];
    return allLinks
      .filter((x) => x.allowedRoles.includes(user.role))
      .map((x) => ({
        ...x,
        label: t(x.key, x.label),
        subItems: x.subItems
          ?.filter((s) => !s.allowedRoles || s.allowedRoles.includes(user.role))
          .map((s) => ({
            ...s,
            label: s.key ? t(s.key, s.label) : s.label,
          })),
      }));
  }, [allLinks, user, language, t]);

  // Primary mobile navigation bar links (max 3-4 items)
  const mobilePrimaryLinks = useMemo(() => {
    if (user?.role === "staff") return accessibleLinks;
    if (user?.role === "accountant") return accessibleLinks.slice(0, 4); // Dashboard, Accounts, Customers, Suppliers
    return accessibleLinks.slice(0, 3); // Dashboard, Sales, Products
  }, [accessibleLinks, user?.role]);

  // Secondary links for mobile "More" drawer
  const mobileDrawerLinks = useMemo(() => {
    if (user?.role === "staff") return [];
    if (user?.role === "accountant") return accessibleLinks.slice(4);
    return accessibleLinks.slice(3); // All financial / admin links
  }, [accessibleLinks, user?.role]);

  // Check if current route belongs to the "More" drawer
  const isDrawerRouteActive = useMemo(() => {
    return mobileDrawerLinks.some(
      (x) => pathname === x.href || (x.subItems && x.subItems.some((sub) => pathname === sub.href))
    );
  }, [mobileDrawerLinks, pathname]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // Role-based route guard
  useEffect(() => {
    if (!user || authLoading) return;

    if (user.role === "accountant") {
      const restrictedForAccountant = ["/sales", "/products", "/categories", "/stock", "/imei", "/staff", "/logs", "/settings"];
      if (restrictedForAccountant.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
        router.replace("/accounts");
      }
    } else if (user.role === "staff") {
      const restrictedForStaff = ["/accounts", "/reports", "/expenses", "/daily-closing", "/staff", "/logs", "/settings", "/suppliers", "/customers", "/imei", "/stock"];
      if (restrictedForStaff.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
        router.replace("/sales");
      }
    }
  }, [user, authLoading, pathname, router]);

  // Close drawer on navigation
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  // Close drawer on ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileDrawerOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Track page visits
  useEffect(() => {
    if (user && pathname) {
      const pageNames: Record<string, string> = {
        "/dashboard": "Dashboard",
        "/accounts": "Cash / Accounts",
        "/customers": "Customers / Khata",
        "/suppliers": "Suppliers",
        "/sales": "Sales POS",
        "/expenses": "Expenses",
        "/products": "Products Catalog",
        "/categories": "Categories Manager",
        "/stock": "Stock Management",
        "/imei": "IMEI Management",
        "/payments": "Payments",
        "/invoices": "Invoices & Receipts",
        "/daily-closing": "Daily Closing",
        "/reports": "Reports & Analytics",
        "/staff": "Staff & Permissions",
        "/logs": "Activity Logs",
        "/settings": "Business Settings",
        "/setup-business": "Business Setup",
        "/setup-business/financial": "Financial Setup (FPS)",
      };
      const title = pageNames[pathname] || pathname;
      logActivity(
        "PAGE_VISIT",
        "Visit",
        `Visited ${title} page (${pathname})`,
        pathname,
        { path: pathname, businessId: activeBusiness?.id },
        { name: user.name, email: user.email, role: user.role }
      );
    }
  }, [user, pathname, activeBusiness?.id]);

  if (authLoading || !user) {
    return <main className={styles.loading}>Loading Almadel workspace...</main>;
  }

  return (
    <div className={styles.page}>
      {/* Desktop Sidebar */}
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/dashboard">
          <span><ShoppingBagIcon /></span>
          <div>
            <strong>Almadel</strong>
            <small>{t("shell.store_management", "Store Management")}</small>
          </div>
        </Link>

        {/* Active Store Badge (Strict 1 Store per Admin) */}
        <div className="px-2 mb-3">
          {activeBusiness ? (
            <Link
              href="/settings"
              className="w-full flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-white border border-gray-200/80 hover:border-[#00875a] shadow-xs transition text-left group"
              title="Store Settings"
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <span className="size-8 rounded-xl bg-[#e6f4ed] text-[#00875a] grid place-items-center shrink-0 overflow-hidden border border-emerald-100/60 shadow-xs">
                  {resolvedLogo ? (
                    <img
                      src={resolvedLogo}
                      alt={activeBusiness.name}
                      className="size-full object-cover rounded-xl"
                    />
                  ) : (
                    <StoreIcon />
                  )}
                </span>
                <div className="overflow-hidden">
                  <strong className="block text-xs font-extrabold text-gray-900 truncate leading-tight group-hover:text-[#00875a] transition">
                    {activeBusiness.name}
                  </strong>
                  <span className="inline-block text-[10px] font-bold text-gray-500 capitalize truncate">
                    {activeBusiness.businessType}
                  </span>
                </div>
              </div>
            </Link>
          ) : (
            <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
              <p>No active business</p>
              <Link href="/setup-business" className="text-[#00875a] underline mt-0.5 block">
                + Set up your business
              </Link>
            </div>
          )}
        </div>

        {/* Pro Plan Active Badge */}
        {activeBusiness && (activeBusiness.subscriptionStatus === "active" || Boolean(activeBusiness.stripeSubscriptionId)) && (
          <div className="mx-2 mb-3 p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-between text-xs shadow-xs">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-base leading-none">🛡️</span>
              <div className="overflow-hidden">
                <span className="block font-black text-emerald-950 text-[11px] leading-tight truncate">
                  Almadel Pro
                </span>
                <span className="block text-[10px] font-bold text-emerald-700">
                  Active Plan
                </span>
              </div>
            </div>
            <Link
              href="/payments"
              className="shrink-0 px-2.5 py-1 rounded-lg bg-[#00875a] hover:bg-[#00744e] text-white text-[10px] font-extrabold transition shadow-xs"
            >
              Billing
            </Link>
          </div>
        )}

        {/* 30-Day Free Trial Badge (Unsubscribed) */}
        {activeBusiness &&
          activeBusiness.subscriptionStatus !== "active" &&
          !activeBusiness.stripeSubscriptionId &&
          (activeBusiness.isTrial || activeBusiness.subscriptionStatus === "trialing") &&
          !activeBusiness.isTrialExpired && (
            <div className="mx-2 mb-3 p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-between text-xs shadow-xs">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-base leading-none">✨</span>
                <div className="overflow-hidden">
                  <span className="block font-black text-emerald-950 text-[11px] leading-tight truncate">
                    30-Day Free Trial
                  </span>
                  <span className="block text-[10px] font-bold text-emerald-700">
                    {activeBusiness.trialDaysRemaining !== undefined
                      ? `${activeBusiness.trialDaysRemaining} days remaining`
                      : "Active Trial"}
                  </span>
                </div>
              </div>
              <Link
                href="/payments"
                className="shrink-0 px-2 py-1 rounded-lg bg-[#00875a] hover:bg-[#00744e] text-white text-[10px] font-extrabold transition shadow-xs"
              >
                Subscribe
              </Link>
            </div>
          )}


        <nav>
          {accessibleLinks.map((x) => {
            const isSectionActive =
              pathname === x.href ||
              (x.subItems && x.subItems.some((sub) => pathname === sub.href));

            return (
              <div key={x.href} className={styles.menuGroup}>
                <Link
                  href={x.href}
                  className={isSectionActive ? styles.active : ""}
                >
                  <i>{x.icon}</i>
                  <span>{x.label}</span>
                </Link>

                {x.subItems && isSectionActive && (
                  <div className={styles.subNav}>
                    {x.subItems.map((sub) => (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        className={`${styles.subLink} ${
                          pathname === sub.href ? styles.subLinkActive : ""
                        }`}
                      >
                        <span style={{ fontSize: 10, opacity: 0.7 }}>↳</span>
                        <span>{sub.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Language Switcher in Sidebar */}
        <div className="mx-2 mt-auto mb-2 p-2 rounded-2xl bg-white border border-gray-200/80 flex items-center justify-between text-xs shadow-2xs">
          <span className="text-[11px] font-bold text-gray-500">Language</span>
          <LanguageSwitcher variant="pill" />
        </div>

        <div className={styles.user}>
          <b>{user.name[0]?.toUpperCase()}</b>
          <span>
            <strong>{user.name}</strong>
            <small>
              {user.role === "admin"
                ? t("role.owner", "Store Owner")
                : user.role === "accountant"
                ? t("role.accountant", "Accountant")
                : t("role.staff", "Staff Member")}
            </small>
          </span>
          <button
            aria-label={t("shell.sign_out", "Sign out")}
            title={t("shell.sign_out", "Sign out")}
            onClick={async () => {
              await logout();
              router.push("/login");
            }}
          >
            ⏻
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className={styles.mobile}>
        <Link className={styles.brand} href="/dashboard">
          <span><ShoppingBagIcon /></span>
          <strong>{activeBusiness?.name || "Almadel"}</strong>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher variant="compact" />
          <button onClick={async () => { await logout(); router.push("/login"); }}>
            {t("shell.sign_out", "Sign out")}
          </button>
        </div>
      </header>

      {/* Main Page Content */}
      <section className={styles.content}>
        {activeBusiness && (activeBusiness.isTrialExpired || activeBusiness.subscriptionStatus === "expired") && (
          <TrialExpiredModal business={activeBusiness} />
        )}
        {children}
      </section>

      {/* Modern Responsive Mobile Bottom Bar */}
      <nav className={styles.bottom} aria-label="Mobile Navigation">
        {mobilePrimaryLinks.map((x) => {
          const isSectionActive =
            pathname === x.href ||
            (x.subItems && x.subItems.some((sub) => pathname === sub.href));
          return (
            <Link
              key={x.href}
              href={x.href}
              className={isSectionActive ? styles.active : ""}
            >
              <i>{x.icon}</i>
              <span>{x.label.split(" ")[0]}</span>
            </Link>
          );
        })}

        {/* Mobile "More" Drawer Button (Admin Only) */}
        {user.role === "admin" && mobileDrawerLinks.length > 0 && (
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className={`${styles.bottomMoreBtn} ${isDrawerRouteActive ? styles.active : ""}`}
            aria-label="Open full workspace navigation menu"
          >
            <i>☰</i>
            <span>{t("shell.more", "More")}</span>
          </button>
        )}
      </nav>

      {/* Mobile "More" Full Drawer / Bottom Sheet */}
      {mobileDrawerOpen && (
        <div
          className={styles.drawerBackdrop}
          onClick={() => setMobileDrawerOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={styles.drawerSheet}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.drawerHandle} />
            <div className={styles.drawerHead}>
              <div>
                <strong className="block text-base font-extrabold text-gray-900">
                  {activeBusiness?.name || "Workspace Tools"}
                </strong>
                <span className="text-xs text-gray-500 font-semibold">
                  Financial Management & Settings
                </span>
              </div>
              <button
                type="button"
                className="size-8 rounded-full bg-gray-100 text-gray-600 font-bold grid place-items-center"
                onClick={() => setMobileDrawerOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className={styles.drawerGrid}>
              {mobileDrawerLinks.map((x) => {
                const isActive = pathname === x.href;
                return (
                  <Link
                    key={x.href}
                    href={x.href}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={`${styles.drawerCard} ${isActive ? styles.drawerCardActive : ""}`}
                  >
                    <span className={styles.drawerCardIcon}>{x.icon}</span>
                    <span className={styles.drawerCardLabel}>{x.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>Signed in as <strong className="text-gray-900">{user.name}</strong></span>
              <button
                onClick={async () => {
                  setMobileDrawerOpen(false);
                  await logout();
                  router.push("/login");
                }}
                className="font-bold text-red-600 hover:underline"
              >
                {t("shell.sign_out", "Sign out")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
