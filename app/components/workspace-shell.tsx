"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/app/components/business-context";
import { TrialExpiredModal } from "@/app/components/trial-expired-modal";
import styles from "./workspace-shell.module.css";
import { logActivity } from "@/app/lib/logger";
import { resolveImageUrl } from "@/app/lib/api";
import { useLanguage } from "./language-context";
import { LanguageSwitcher } from "./language-switcher";
import { isFinancialWorkspacePath } from "@/app/lib/access";
import {
  financialLinks,
  isPathAllowedForNavRole,
  navRoleFallbackPath,
  posLinks,
} from "@/app/lib/workspace-nav";
import { useNavRole } from "@/hooks/useNavRole";
import { useToast } from "@/app/components/toast-context";
import { useRealtime } from "@/app/components/realtime-provider";
import { useTheme } from "@/app/components/theme-context";
import { BrandMark, Icon, routeIcon } from "@/app/components/icons";

const COLLAPSE_KEY = "almadel_sidebar_collapsed";

/** Presentation-only grouping of the existing nav links. */
const NAV_GROUPS: Array<{ id: string; label: string; labelKey: string; hrefs: string[] }> = [
  { id: "overview", label: "Overview", labelKey: "nav.group_overview", hrefs: ["/dashboard", "/sales", "/products"] },
  {
    id: "books",
    label: "Books",
    labelKey: "nav.group_books",
    hrefs: ["/accounts", "/customers", "/suppliers", "/expenses", "/invoices", "/daily-closing", "/reports"],
  },
  { id: "store", label: "Store", labelKey: "nav.group_store", hrefs: ["/imei", "/payments", "/staff", "/logs", "/settings"] },
];

function initials(name?: string | null) {
  if (!name) return "A";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "A";
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading, logout } = useAuth();
  const { activeBusiness, workspaceMode, isLoading: businessLoading } = useBusiness();
  const { language, t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const resolvedLogo = resolveImageUrl(activeBusiness?.logoUrl);

  const allLinks = workspaceMode === "pos" ? posLinks : financialLinks;

  const navRole = useNavRole();

  // Filter links by membership-aware role and translate labels dynamically
  const accessibleLinks = useMemo(() => {
    if (!user || businessLoading) return [];
    return allLinks
      .filter((x) => x.allowedRoles.includes(navRole))
      .map((x) => ({
        ...x,
        label: t(x.key, x.label),
        subItems: x.subItems
          ?.filter((s) => !s.allowedRoles || s.allowedRoles.includes(navRole))
          .map((s) => ({
            ...s,
            label: s.key ? t(s.key, s.label) : s.label,
          })),
      }));
  }, [allLinks, user, navRole, language, t, businessLoading]);

  // Primary mobile navigation bar links (max 3-4 items)
  const mobilePrimaryLinks = useMemo(() => {
    if (navRole === "staff") return accessibleLinks;
    if (workspaceMode === "financial") {
      // Dashboard, Sales, Products, Accounts
      return accessibleLinks.slice(0, 4);
    }
    // POS: Dashboard, Sales, Products
    return accessibleLinks.slice(0, 3);
  }, [accessibleLinks, navRole, workspaceMode]);

  // Secondary links for mobile "More" drawer
  const mobileDrawerLinks = useMemo(() => {
    if (navRole === "staff") return [];
    if (workspaceMode === "financial") return accessibleLinks.slice(4);
    return accessibleLinks.slice(3);
  }, [accessibleLinks, navRole, workspaceMode]);

  // Check if current route belongs to the "More" drawer
  const isDrawerRouteActive = useMemo(() => {
    return mobileDrawerLinks.some(
      (x) => pathname === x.href || (x.subItems && x.subItems.some((sub) => pathname === sub.href))
    );
  }, [mobileDrawerLinks, pathname]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // POS workspace: financial-only pages (e.g. /customers khata) are not available — use Sales for walk-in customers.
  useEffect(() => {
    if (!user || authLoading || businessLoading) return;
    if (workspaceMode !== "pos") return;
    if (!isFinancialWorkspacePath(pathname)) return;

    showToast(
      "Customers Khata and other books features are in Financial workspace. Switch workspace in business setup or open Sales for POS.",
      "error",
    );
    router.replace("/sales");
  }, [user, authLoading, businessLoading, workspaceMode, pathname, router, showToast]);

  // Role-based route guard — same rules as sidebar `allowedRoles` (no URL bypass).
  useEffect(() => {
    if (!user || authLoading || businessLoading) return;
    if (navRole === "admin") return;

    if (isPathAllowedForNavRole(pathname, allLinks, navRole)) return;

    router.replace(navRoleFallbackPath(navRole));
  }, [user, navRole, authLoading, businessLoading, pathname, router, allLinks]);

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
      );
    }
  }, [user, pathname, activeBusiness?.id]);

  // ---------- Presentation-only state ----------
  const { businesses, switchBusiness } = useBusiness();
  const { socket } = useRealtime();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [bizMenuOpen, setBizMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [liveConnected, setLiveConnected] = useState(false);
  const bizMenuRef = useRef<HTMLDivElement | null>(null);
  const paletteInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Realtime connection indicator (reads the existing socket; never changes it)
  useEffect(() => {
    if (!socket) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLiveConnected(false);
      return;
    }
    const onConnect = () => setLiveConnected(true);
    const onDisconnect = () => setLiveConnected(false);
    setLiveConnected(socket.connected);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  // Close business menu on outside click / navigation
  useEffect(() => {
    if (!bizMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (bizMenuRef.current && !bizMenuRef.current.contains(e.target as Node)) setBizMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBizMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [bizMenuOpen]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBizMenuOpen(false);
    setPaletteOpen(false);
  }, [pathname]);

  // ⌘K / Ctrl+K quick navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!paletteOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPaletteQuery("");
    setPaletteIndex(0);
    const id = window.setTimeout(() => paletteInputRef.current?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [paletteOpen]);

  const flatDestinations = useMemo(() => {
    const out: Array<{ href: string; label: string; parent?: string }> = [];
    for (const link of accessibleLinks) {
      out.push({ href: link.href, label: link.label });
      for (const sub of link.subItems ?? []) {
        if (sub.href !== link.href) out.push({ href: sub.href, label: sub.label, parent: link.label });
      }
    }
    return out;
  }, [accessibleLinks]);

  const paletteResults = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return flatDestinations;
    return flatDestinations.filter(
      (d) => d.label.toLowerCase().includes(q) || d.href.toLowerCase().includes(q) || d.parent?.toLowerCase().includes(q),
    );
  }, [flatDestinations, paletteQuery]);

  const groupedLinks = useMemo(() => {
    const used = new Set<string>();
    const groups = NAV_GROUPS.map((g) => {
      const items = accessibleLinks.filter((l) => g.hrefs.includes(l.href));
      items.forEach((l) => used.add(l.href));
      return { ...g, items };
    });
    const rest = accessibleLinks.filter((l) => !used.has(l.href));
    if (rest.length) groups[0].items.push(...rest);
    return groups.filter((g) => g.items.length > 0);
  }, [accessibleLinks]);

  const currentTitle = useMemo(() => {
    for (const d of flatDestinations) {
      if (pathname === d.href) return d.label;
    }
    for (const d of flatDestinations) {
      if (pathname.startsWith(`${d.href}/`)) return d.label;
    }
    if (pathname.startsWith("/setup-business")) return "Business Setup";
    return "";
  }, [flatDestinations, pathname]);

  const canSell = navRole === "admin" || navRole === "staff";
  const workspaceLabel =
    workspaceMode === "financial" ? t("shell.workspace_financial", "Financial") : t("shell.workspace_pos", "POS");
  const roleLabel =
    navRole === "admin"
      ? t("role.owner", "Store Owner")
      : navRole === "accountant"
      ? t("role.accountant", "Accountant")
      : t("role.staff", "Staff Member");

  const isPro =
    !!activeBusiness && (activeBusiness.subscriptionStatus === "active" || Boolean(activeBusiness.stripeSubscriptionId));
  const isTrialActive =
    !!activeBusiness &&
    activeBusiness.subscriptionStatus !== "active" &&
    !activeBusiness.stripeSubscriptionId &&
    (activeBusiness.isTrial || activeBusiness.subscriptionStatus === "trialing") &&
    !activeBusiness.isTrialExpired;
  const trialDays = activeBusiness?.trialDaysRemaining;
  const trialPct = trialDays !== undefined ? Math.max(4, Math.min(100, (trialDays / 30) * 100)) : 100;

  const handleSignOut = async () => {
    setMobileDrawerOpen(false);
    await logout();
    showToast("You have been signed out.", "success");
    router.push("/login");
  };

  const isActive = (x: { href: string; subItems?: Array<{ href: string }> }) =>
    pathname === x.href ||
    pathname.startsWith(`${x.href}/`) ||
    Boolean(x.subItems && x.subItems.some((sub) => pathname === sub.href));

  const goToPaletteResult = (href: string) => {
    setPaletteOpen(false);
    router.push(href);
  };

  if (authLoading || !user) {
    return (
      <main className={styles.loading} aria-busy="true">
        <BrandMark size={40} />
        <div className={styles.loadingBar} aria-hidden>
          <span />
        </div>
        <span>{t("shell.loading", "Loading Almadel workspace…")}</span>
      </main>
    );
  }

  const businessAvatar = (size: "sm" | "md" = "md") => (
    <span className={`${styles.bizAvatar} ${size === "sm" ? styles.bizAvatarSm : ""}`}>
      {resolvedLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolvedLogo} alt={activeBusiness?.name || "Business logo"} />
      ) : (
        initials(activeBusiness?.name)
      )}
    </span>
  );

  return (
    <div className={`${styles.page} ${collapsed ? styles.isCollapsed : ""}`} data-workspace={workspaceMode}>
      {/* ================= Desktop / tablet sidebar ================= */}
      <aside className={styles.sidebar} aria-label="Workspace navigation">
        <div className={styles.brandRow}>
          <Link className={styles.brand} href="/dashboard" aria-label="Almadel dashboard">
            <BrandMark size={28} />
            <span className={styles.brandText}>
              <strong>Almadel</strong>
              <small>{t("shell.store_management", "Store Management")}</small>
            </span>
          </Link>
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon name="panel" size={16} />
          </button>
        </div>

        {/* Active business + switcher */}
        <div className={styles.bizWrap} ref={bizMenuRef}>
          {activeBusiness ? (
            <button
              type="button"
              className={styles.bizButton}
              onClick={() => setBizMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={bizMenuOpen}
              title={activeBusiness.name}
            >
              {businessAvatar()}
              <span className={styles.bizText}>
                <strong>{activeBusiness.name}</strong>
                <small>{activeBusiness.businessType}</small>
              </span>
              <Icon name="updown" size={14} className={styles.bizChevron} />
            </button>
          ) : (
            <div className={styles.noBiz}>
              <p>{t("shell.no_active_business", "No active business")}</p>
              <Link href="/setup-business">{t("shell.setup_business", "+ Set up your business")}</Link>
            </div>
          )}

          {bizMenuOpen && activeBusiness && (
            <div className={`${styles.bizMenu} al-pop`} role="menu">
              <div className={styles.menuLabel}>{t("shell.businesses", "Businesses")}</div>
              {(businesses.length ? businesses : [activeBusiness]).map((b) => {
                const current = b.id === activeBusiness.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={current}
                    className={`${styles.menuItem} ${current ? styles.menuItemOn : ""}`}
                    onClick={() => {
                      if (!current) switchBusiness(b.id);
                      setBizMenuOpen(false);
                    }}
                  >
                    <span className={`${styles.bizAvatar} ${styles.bizAvatarSm}`}>{initials(b.name)}</span>
                    <span className={styles.menuItemText}>
                      <strong>{b.name}</strong>
                      <small>
                        {b.businessType} · {b.workspaceMode === "financial" ? "Financial" : "POS"}
                      </small>
                    </span>
                    {current && <Icon name="check" size={15} strokeWidth={2} className={styles.menuCheck} />}
                  </button>
                );
              })}
              <div className={styles.menuSep} />
              {navRole === "admin" && (
                <Link href="/settings" className={styles.menuLink} role="menuitem">
                  <Icon name="settings" size={15} />
                  {t("shell.store_settings", "Store settings")}
                </Link>
              )}
              <Link href="/setup-business" className={styles.menuLink} role="menuitem">
                <Icon name="plus" size={15} />
                {t("shell.setup_business", "+ Set up your business").replace(/^\+\s*/, "")}
              </Link>
            </div>
          )}
        </div>

        {/* Workspace mode indicator */}
        <div className={styles.workspace} aria-label="Workspace mode">
          <span className={workspaceMode === "pos" ? styles.wsOn : ""}>
            <Icon name="cart" size={13} />
            {t("shell.workspace_pos", "POS")}
          </span>
          <span className={workspaceMode === "financial" ? styles.wsOn : ""}>
            <Icon name="wallet" size={13} />
            {t("shell.workspace_financial", "Financial")}
          </span>
        </div>

        <nav className={styles.nav}>
          {groupedLinks.map((group) => (
            <div key={group.id} className={styles.navGroup}>
              <div className={styles.navHeading}>{t(group.labelKey, group.label)}</div>
              {group.items.map((x) => {
                const active = isActive(x);
                return (
                  <div key={x.href} className={styles.menuGroup}>
                    <Link
                      href={x.href}
                      className={`${styles.navLink} ${active ? styles.active : ""}`}
                      title={collapsed ? x.label : undefined}
                      aria-current={pathname === x.href ? "page" : undefined}
                    >
                      <Icon name={routeIcon(x.href)} size={17} className={styles.navIcon} />
                      <span className={styles.navLabel}>{x.label}</span>
                      {x.subItems && x.subItems.length > 0 && (
                        <Icon name="down" size={13} className={`${styles.navCaret} ${active ? styles.navCaretOpen : ""}`} />
                      )}
                    </Link>

                    {x.subItems && active && (
                      <div className={styles.subNav}>
                        {x.subItems.map((sub) => (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={`${styles.subLink} ${pathname === sub.href ? styles.subLinkActive : ""}`}
                            aria-current={pathname === sub.href ? "page" : undefined}
                          >
                            {sub.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Subscription status */}
        {isPro && (
          <div className={styles.plan}>
            <div className={styles.planRow}>
              <span className={styles.planName}>
                <Icon name="shield" size={14} />
                Almadel Pro
              </span>
              <Link href="/payments" className={styles.planLink}>
                {t("shell.billing", "Billing")}
              </Link>
            </div>
            <small>{t("shell.active_plan", "Active Plan")}</small>
          </div>
        )}
        {isTrialActive && (
          <div className={styles.plan}>
            <div className={styles.planRow}>
              <span className={styles.planName}>
                <Icon name="sparkle" size={14} />
                {t("shell.free_trial", "30-Day Free Trial")}
              </span>
              <Link href="/payments" className={`${styles.planLink} ${styles.planLinkPrimary}`}>
                {t("shell.subscribe", "Subscribe")}
              </Link>
            </div>
            <div className={styles.planMeter} aria-hidden>
              <span style={{ width: `${trialPct}%` }} />
            </div>
            <small>
              {trialDays !== undefined
                ? `${trialDays} ${t("shell.days_remaining", "days remaining")}`
                : t("shell.active_trial", "Active Trial")}
            </small>
          </div>
        )}

        <div className={styles.user}>
          <b aria-hidden>{initials(user.name)}</b>
          <span>
            <strong>{user.name}</strong>
            <small>{roleLabel}</small>
          </span>
          <button
            type="button"
            aria-label={t("shell.sign_out", "Sign out")}
            title={t("shell.sign_out", "Sign out")}
            onClick={handleSignOut}
          >
            <Icon name="logout" size={16} />
          </button>
        </div>
      </aside>

      {/* ================= Main sheet ================= */}
      <div className={styles.main}>
        {/* Desktop header */}
        <header className={styles.topbar}>
          <div className={styles.crumbs}>
            <span className={styles.crumbWs}>{workspaceLabel}</span>
            {currentTitle && (
              <>
                <Icon name="right" size={12} />
                <strong>{currentTitle}</strong>
              </>
            )}
          </div>
          <span className={styles.spacer} />
          <button type="button" className={styles.searchBtn} onClick={() => setPaletteOpen(true)}>
            <Icon name="search" size={15} />
            <span>{t("shell.jump_to", "Jump to a page…")}</span>
            <kbd>⌘K</kbd>
          </button>
          <span
            className={`${styles.live} ${liveConnected ? styles.liveOn : ""}`}
            title={liveConnected ? "Realtime updates connected" : "Realtime updates offline"}
          >
            <span className={styles.liveDot} />
            {liveConnected ? t("shell.live", "Live") : t("shell.offline", "Offline")}
          </span>
          <LanguageSwitcher variant="compact" />
          <button
            type="button"
            className={styles.iconBtn}
            onClick={toggleTheme}
            aria-label={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={resolvedTheme === "dark" ? "Light theme" : "Dark theme"}
          >
            <Icon name={resolvedTheme === "dark" ? "sun" : "moon"} size={16} />
          </button>
          {canSell && pathname !== "/sales" && (
            <Link href="/sales" className={styles.primaryAction}>
              <Icon name="plus" size={15} strokeWidth={2} />
              {t("action.new_sale", "New Sale")}
            </Link>
          )}
        </header>

        {/* Mobile header */}
        <header className={styles.mobile}>
          <Link className={styles.mobileBrand} href="/dashboard">
            {activeBusiness ? businessAvatar("sm") : <BrandMark size={30} />}
            <span>
              <strong>{activeBusiness?.name || "Almadel"}</strong>
              <small>
                {workspaceLabel}
                {currentTitle ? ` · ${currentTitle}` : ""}
              </small>
            </span>
          </Link>
          <span className={`${styles.liveDot} ${liveConnected ? styles.liveDotOn : ""}`} aria-hidden />
          <button
            type="button"
            className={styles.iconBtn}
            onClick={toggleTheme}
            aria-label={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            <Icon name={resolvedTheme === "dark" ? "sun" : "moon"} size={17} />
          </button>
          <LanguageSwitcher variant="compact" />
        </header>

        {/* Page content */}
        <section className={styles.content}>
          <div className={`${styles.contentInner} al-page-enter`} key={pathname}>
            {activeBusiness && (activeBusiness.isTrialExpired || activeBusiness.subscriptionStatus === "expired") && (
              <TrialExpiredModal business={activeBusiness} />
            )}
            {children}
          </div>
        </section>
      </div>

      {/* ================= Mobile bottom bar ================= */}
      <nav className={styles.bottom} aria-label="Mobile Navigation">
        {mobilePrimaryLinks.map((x) => {
          const active = isActive(x);
          return (
            <Link key={x.href} href={x.href} className={active ? styles.active : ""} aria-current={active ? "page" : undefined}>
              <Icon name={routeIcon(x.href)} size={21} strokeWidth={active ? 1.9 : 1.6} />
              <span>{x.label.split(" ")[0]}</span>
            </Link>
          );
        })}

        {navRole === "admin" && mobileDrawerLinks.length > 0 && (
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className={`${styles.bottomMoreBtn} ${isDrawerRouteActive ? styles.active : ""}`}
            aria-label="Open full workspace navigation menu"
            aria-expanded={mobileDrawerOpen}
          >
            <Icon name="grid" size={21} />
            <span>{t("shell.more", "More")}</span>
          </button>
        )}
      </nav>

      {/* ================= Mobile "More" sheet ================= */}
      {mobileDrawerOpen && (
        <div
          className={styles.drawerBackdrop}
          onClick={() => setMobileDrawerOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="More navigation"
        >
          <div className={styles.drawerSheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHandle} />
            <div className={styles.drawerHead}>
              <div className={styles.drawerTitle}>
                {businessAvatar("sm")}
                <span>
                  <strong>{activeBusiness?.name || "Workspace Tools"}</strong>
                  <small>
                    {workspaceLabel} · {roleLabel}
                  </small>
                </span>
              </div>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Close menu"
              >
                <Icon name="x" size={17} />
              </button>
            </div>

            <div className={styles.drawerGrid}>
              {mobileDrawerLinks.map((x) => {
                const active = isActive(x);
                return (
                  <Link
                    key={x.href}
                    href={x.href}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={`${styles.drawerCard} ${active ? styles.drawerCardActive : ""}`}
                  >
                    <span className={styles.drawerCardIcon}>
                      <Icon name={routeIcon(x.href)} size={20} />
                    </span>
                    <span className={styles.drawerCardLabel}>{x.label}</span>
                  </Link>
                );
              })}
            </div>

            {businesses.length > 1 && (
              <div className={styles.drawerSection}>
                <div className={styles.menuLabel}>{t("shell.businesses", "Businesses")}</div>
                {businesses.map((b) => {
                  const current = b.id === activeBusiness?.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      className={`${styles.menuItem} ${current ? styles.menuItemOn : ""}`}
                      onClick={() => {
                        if (!current) switchBusiness(b.id);
                        setMobileDrawerOpen(false);
                      }}
                    >
                      <span className={`${styles.bizAvatar} ${styles.bizAvatarSm}`}>{initials(b.name)}</span>
                      <span className={styles.menuItemText}>
                        <strong>{b.name}</strong>
                        <small>{b.businessType}</small>
                      </span>
                      {current && <Icon name="check" size={15} strokeWidth={2} className={styles.menuCheck} />}
                    </button>
                  );
                })}
              </div>
            )}

            {(isPro || isTrialActive) && (
              <Link href="/payments" className={styles.drawerPlan} onClick={() => setMobileDrawerOpen(false)}>
                <Icon name={isPro ? "shield" : "sparkle"} size={16} />
                <span>
                  {isPro
                    ? `Almadel Pro · ${t("shell.active_plan", "Active Plan")}`
                    : `${t("shell.free_trial", "30-Day Free Trial")}${
                        trialDays !== undefined ? ` · ${trialDays} ${t("shell.days_remaining", "days remaining")}` : ""
                      }`}
                </span>
                <Icon name="right" size={15} />
              </Link>
            )}

            <div className={styles.drawerFoot}>
              <span className={styles.drawerUser}>
                <b aria-hidden>{initials(user.name)}</b>
                <span>
                  <strong>{user.name}</strong>
                  <small>{roleLabel}</small>
                </span>
              </span>
              <LanguageSwitcher variant="pill" />
              <button type="button" onClick={handleSignOut} className={styles.signOut}>
                <Icon name="logout" size={15} />
                {t("shell.sign_out", "Sign out")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= Quick navigation palette ================= */}
      {paletteOpen && (
        <div className={styles.paletteBackdrop} onClick={() => setPaletteOpen(false)} role="presentation">
          <div
            className={styles.palette}
            role="dialog"
            aria-modal="true"
            aria-label="Jump to a page"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.paletteInput}>
              <Icon name="search" size={18} />
              <input
                ref={paletteInputRef}
                value={paletteQuery}
                onChange={(e) => {
                  setPaletteQuery(e.target.value);
                  setPaletteIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setPaletteIndex((i) => Math.min(i + 1, Math.max(paletteResults.length - 1, 0)));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setPaletteIndex((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter") {
                    const target = paletteResults[paletteIndex];
                    if (target) goToPaletteResult(target.href);
                  } else if (e.key === "Escape") {
                    setPaletteOpen(false);
                  }
                }}
                placeholder={t("shell.jump_placeholder", "Search pages — Khata, Stock, Daily Closing…")}
                aria-label="Search pages"
              />
              <kbd>esc</kbd>
            </div>
            <div className={styles.paletteList} role="listbox">
              {paletteResults.length === 0 && <div className={styles.paletteEmpty}>No matching pages</div>}
              {paletteResults.map((d, i) => (
                <button
                  key={d.href + d.label}
                  type="button"
                  role="option"
                  aria-selected={i === paletteIndex}
                  className={`${styles.paletteItem} ${i === paletteIndex ? styles.paletteItemOn : ""}`}
                  onMouseEnter={() => setPaletteIndex(i)}
                  onClick={() => goToPaletteResult(d.href)}
                >
                  <Icon name={routeIcon(d.href)} size={16} />
                  <span className={styles.paletteLabel}>
                    {d.parent ? <span className={styles.paletteParent}>{d.parent} / </span> : null}
                    {d.label}
                  </span>
                  {pathname === d.href && <span className={styles.paletteHere}>Current</span>}
                </button>
              ))}
            </div>
            <div className={styles.paletteFoot}>
              <span>↑↓ navigate</span>
              <span>↵ open</span>
              <span className={styles.spacer} />
              <span>{workspaceLabel} workspace</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
