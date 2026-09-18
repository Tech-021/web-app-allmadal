"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/app/components/business-context";
import styles from "./workspace-shell.module.css";
import { logActivity } from "@/app/lib/logger";

const posLinks: Array<{
  href: string;
  label: string;
  icon: string;
  admin?: boolean;
  subItems?: Array<{ href: string; label: string }>;
}> = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/sales", label: "Sales", icon: "🛒" },
  {
    href: "/products",
    label: "Products",
    icon: "📦",
    subItems: [
      { href: "/products", label: "All Products" },
      { href: "/categories", label: "Categories" },
    ],
  },
  { href: "/stock", label: "Stock", icon: "📥", admin: true },
  { href: "/payments", label: "Payments / Billing", icon: "💳", admin: true },
  { href: "/staff", label: "Staff", icon: "👥", admin: true },
  { href: "/logs", label: "Activity Logs", icon: "📋", admin: true },
];

const financialLinks: Array<{
  href: string;
  label: string;
  icon: string;
  admin?: boolean;
  subItems?: Array<{ href: string; label: string }>;
}> = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/sales", label: "Sales", icon: "🛒" },
  {
    href: "/products",
    label: "Products / Inventory",
    icon: "📦",
    subItems: [
      { href: "/products", label: "All Products" },
      { href: "/categories", label: "Categories" },
      { href: "/stock", label: "Stock Levels" },
    ],
  },
  { href: "/accounts", label: "Cash / Accounts", icon: "💵", admin: true },
  { href: "/customers", label: "Customers / Khata", icon: "👥", admin: true },
  { href: "/suppliers", label: "Suppliers", icon: "🏢", admin: true },
  { href: "/expenses", label: "Expenses", icon: "💸", admin: true },
  { href: "/imei", label: "IMEI Management", icon: "📱", admin: true },
  { href: "/payments", label: "Payments / Billing", icon: "💳", admin: true },
  { href: "/invoices", label: "Invoices / Receipts", icon: "🧾", admin: true },
  { href: "/daily-closing", label: "Daily Closing", icon: "🔒", admin: true },
  { href: "/reports", label: "Reports", icon: "📈", admin: true },
  { href: "/staff", label: "Staff & Permissions", icon: "👤", admin: true },
  { href: "/logs", label: "Activity Logs", icon: "📋", admin: true },
  { href: "/settings", label: "Settings", icon: "⚙️", admin: true },
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
  const { activeBusiness, businesses, switchBusiness, workspaceMode } = useBusiness();
  const router = useRouter();
  const pathname = usePathname();

  const [bizDropdownOpen, setBizDropdownOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allLinks = workspaceMode === "pos" ? posLinks : financialLinks;
  
  // Filter links by user role
  const accessibleLinks = useMemo(() => {
    if (!user) return [];
    if (user.role === "staff") {
      return allLinks.filter((x) => !x.admin);
    }
    return allLinks;
  }, [allLinks, user]);

  // Primary mobile navigation bar links (max 3-4 items)
  const mobilePrimaryLinks = useMemo(() => {
    if (user?.role === "staff") return accessibleLinks;
    return accessibleLinks.slice(0, 3); // Dashboard, Sales, Products
  }, [accessibleLinks, user?.role]);

  // Secondary links for mobile "More" drawer
  const mobileDrawerLinks = useMemo(() => {
    if (user?.role === "staff") return [];
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

  // Close dropdown / drawer on navigation
  useEffect(() => {
    setMobileDrawerOpen(false);
    setBizDropdownOpen(false);
  }, [pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setBizDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close drawer on ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileDrawerOpen(false);
        setBizDropdownOpen(false);
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
            <small>Store Management</small>
          </div>
        </Link>

        {/* Business Selector / Active Store Badge */}
        <div ref={dropdownRef} className="relative px-2 mb-3">
          {activeBusiness ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setBizDropdownOpen(!bizDropdownOpen)}
                className="w-full flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-white border border-gray-200/80 hover:border-[#00875a] shadow-xs transition text-left group cursor-pointer"
                title="Click to switch or manage businesses"
                aria-expanded={bizDropdownOpen}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <span className="size-8 rounded-xl bg-[#e6f4ed] text-[#00875a] grid place-items-center shrink-0">
                    <StoreIcon />
                  </span>
                  <div className="overflow-hidden">
                    <strong className="block text-xs font-extrabold text-gray-900 truncate leading-tight group-hover:text-[#00875a] transition">
                      {activeBusiness.name}
                    </strong>
                    <span className="inline-block text-[10px] font-bold text-gray-500 capitalize">
                      {activeBusiness.businessType}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 font-bold shrink-0">▼</span>
              </button>

              {/* Dropdown Menu */}
              {bizDropdownOpen && (
                <div className="absolute top-full left-2 right-2 mt-1.5 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                    My Businesses
                  </div>
                  {businesses.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        switchBusiness(b.id);
                        setBizDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs font-bold transition ${
                        b.id === activeBusiness.id
                          ? "bg-[#e6f4ed] text-[#00875a]"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="truncate">{b.name}</span>
                      {b.id === activeBusiness.id && <span className="text-[11px]">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
              <p>No active business</p>
              <Link href="/setup-business" className="text-[#00875a] underline mt-0.5 block">
                + Set up your business
              </Link>
            </div>
          )}
        </div>

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

        <div className={styles.user}>
          <b>{user.name[0]?.toUpperCase()}</b>
          <span>
            <strong>{user.name}</strong>
            <small>{user.role === "admin" ? "Store Owner" : "Staff Member"}</small>
          </span>
          <button aria-label="Sign out" onClick={async () => { await logout(); router.push("/login"); }}>
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
        <button onClick={async () => { await logout(); router.push("/login"); }}>
          Sign out
        </button>
      </header>

      {/* Main Page Content */}
      <section className={styles.content}>{children}</section>

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
            <span>More</span>
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
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
