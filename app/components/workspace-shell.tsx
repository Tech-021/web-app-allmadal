"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import styles from "./workspace-shell.module.css";

const links = [{href:"/dashboard",label:"Dashboard",icon:"▦"},{href:"/products",label:"Products",icon:"□"},{href:"/stock",label:"Stock",icon:"＋"},{href:"/staff",label:"Staff",icon:"♙",admin:true}];

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth(); const router=useRouter(); const pathname=usePathname();
  useEffect(()=>{if(!isLoading&&!user)router.replace("/login")},[isLoading,user,router]);
  if(isLoading||!user)return <main className={styles.loading}>Loading workspace…</main>;
  return <div className={styles.page}>
    <aside className={styles.sidebar}><Link className={styles.brand} href="/dashboard"><span>AM</span><div><strong>Al Madel</strong><small>Inventory</small></div></Link><nav>{links.filter(x=>!x.admin||user.role==="admin").map(x=><Link key={x.href} href={x.href} className={pathname===x.href?styles.active:""}><i>{x.icon}</i>{x.label}</Link>)}</nav><div className={styles.user}><b>{user.name[0]?.toUpperCase()}</b><span><strong>{user.name}</strong><small>{user.role}</small></span><button aria-label="Sign out" onClick={async()=>{await logout();router.push("/login")}}>↪</button></div></aside>
    <header className={styles.mobile}><Link className={styles.brand} href="/dashboard"><span>AM</span><strong>Al Madel</strong></Link><button onClick={async()=>{await logout();router.push("/login")}}>Sign out</button></header>
    <section className={styles.content}>{children}</section>
    <nav className={styles.bottom}>{links.filter(x=>!x.admin||user.role==="admin").map(x=><Link key={x.href} href={x.href} className={pathname===x.href?styles.active:""}><i>{x.icon}</i><span>{x.label}</span></Link>)}</nav>
  </div>;
}
