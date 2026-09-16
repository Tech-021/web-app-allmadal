"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/app/components/business-context";
import styles from "./workspace-shell.module.css";
import { logActivity } from "@/app/lib/logger";

const links: Array<{
  href: string;
  label: string;
  icon: string;
  admin?: boolean;
  subItems?: Array<{ href: string; label: string }>;
}> = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  {
    href: "/products",
    label: "Products",
    icon: "📦",
    subItems: [
      { href: "/products", label: "All Products" },
      { href: "/categories", label: "Categories" },
    ],
  },
  { href: "/stock", label: "Stock", icon: "📥" },
  { href: "/staff", label: "Staff", icon: "👥", admin: true },
  { href: "/logs", label: "Activity Logs", icon: "📋", admin: true },
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
  const { activeBusiness, businesses, switchBusiness, isLoading: bizLoading } = useBusiness();
  const router = useRouter();
  const pathname = usePathname();

  const [bizDropdownOpen, setBizDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

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

  // Track page visits
  useEffect(() => {
    if (user && pathname) {
      const pageNames: Record<string, string> = {
        "/dashboard": "Dashboard",
        "/products": "Products Catalog",
        "/categories": "Categories Manager",
        "/stock": "Stock Management",
        "/staff": "Staff Management",
        "/logs": "Activity Logs",
        "/setup-business": "Business Setup",
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
                className="w-full flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-white border border-gray-200/80 hover:border-[#00875a] shadow-sm transition text-left group cursor-pointer"
                title="Click to switch or manage businesses"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <span className="size-8 rounded-xl bg-[#e6f4ed] text-[#00875a] grid place-items-center shrink-0">
                    <StoreIcon />
                  </span>
                  <div className="overflow-hidden">
                    <strong className="block text-xs font-extrabold text-gray-900 truncate leading-tight group-hover:text-[#00875a] transition">
                      {activeBusiness.name}
                    </strong>
                    <span className="inline-block text-[10px] font-bold text-gray-400 capitalize">
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

                  {user.role === "admin" && (
                    <div className="pt-1 border-t border-gray-100 mt-1">
                      <Link
                        href="/setup-business"
                        onClick={() => setBizDropdownOpen(false)}
                        className="w-full flex items-center gap-1.5 p-2 rounded-xl text-xs font-bold text-[#00875a] hover:bg-[#e6f4ed] transition"
                      >
                        <span>+</span>
                        <span>Set Up New Business</span>
                      </Link>
                    </div>
                  )}
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
          {links
            .filter((x) => !x.admin || user.role === "admin")
            .map((x) => {
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

      <header className={styles.mobile}>
        <Link className={styles.brand} href="/dashboard">
          <span><ShoppingBagIcon /></span>
          <strong>{activeBusiness?.name || "Almadel"}</strong>
        </Link>
        <button onClick={async () => { await logout(); router.push("/login"); }}>
          Sign out
        </button>
      </header>

      <section className={styles.content}>{children}</section>

      <nav className={styles.bottom}>
        {links
          .filter((x) => !x.admin || user.role === "admin")
          .map((x) => {
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
                <span>{x.label}</span>
              </Link>
            );
          })}
      </nav>
    </div>
  );
}
