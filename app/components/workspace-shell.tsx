"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import styles from "./workspace-shell.module.css";

const links: Array<{
  href: string;
  label: string;
  icon: string;
  admin?: boolean;
  subItems?: Array<{ href: string; label: string }>;
}> = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  {
    href: "/products",
    label: "Products",
    icon: "□",
    subItems: [
      { href: "/products", label: "All Products" },
      { href: "/categories", label: "Categories" },
    ],
  },
  { href: "/stock", label: "Stock", icon: "＋" },
  { href: "/staff", label: "Staff", icon: "♙", admin: true },
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

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  if (isLoading || !user) return <main className={styles.loading}>Loading Almadel workspace…</main>;

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
            <small>{user.role}</small>
          </span>
          <button aria-label="Sign out" onClick={async () => { await logout(); router.push("/login"); }}>
            ↪
          </button>
        </div>
      </aside>

      <header className={styles.mobile}>
        <Link className={styles.brand} href="/dashboard">
          <span><ShoppingBagIcon /></span>
          <strong>Almadel</strong>
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

