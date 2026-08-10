"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Field } from "./auth-shell";
import { UserRole, useAuth } from "@/hooks/useAuth";

export function LoginForm() {
  const router = useRouter(); const { login } = useAuth();
  const [role, setRole] = useState<UserRole>("staff"); const [show, setShow] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try { const user = await login({ email: String(form.get("email")), password: String(form.get("password")), role }); router.push(`/dashboard?role=${user.role}`); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to sign in."); }
    finally { setBusy(false); }
  }
  return <div className="w-full"><h1 className="text-[2rem] font-semibold tracking-[-.035em] text-[#17251e]">Welcome back</h1><p className="mt-2 text-sm text-[#758078]">Enter your details to access your workspace.</p>
    <div className="mt-8 grid grid-cols-2 gap-1 rounded-xl bg-[#e9ece9] p-1" role="group" aria-label="Select account role">{(["staff", "admin"] as UserRole[]).map(item => <button key={item} type="button" onClick={() => setRole(item)} className={`rounded-[9px] px-4 py-2.5 text-sm font-semibold capitalize transition ${role === item ? "bg-white text-[#183d2b] shadow-sm" : "text-[#768079] hover:text-[#35483e]"}`}>{item}</button>)}</div>
    <form className="mt-7 space-y-5" onSubmit={submit}><Field label="Email address" name="email" type="email" placeholder="you@almadel.com" autoComplete="email" required /><Field label="Password" name="password" type={show ? "text" : "password"} placeholder="Enter your password" autoComplete="current-password" minLength={8} required right={<button className="absolute inset-y-0 right-0 px-4 text-xs font-semibold text-[#617068]" type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}>{show ? "Hide" : "Show"}</button>} />
      <div className="flex items-center justify-between text-sm"><label className="flex items-center gap-2 text-[#66736c]"><input className="accent-[#1d4934]" type="checkbox" /> Remember me</label><Link className="font-semibold text-[#1d4934] hover:underline" href="/forgot-password">Forgot password?</Link></div>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}<button disabled={busy} className="h-12 w-full rounded-xl bg-[#1d4934] font-semibold text-white shadow-[0_8px_20px_rgba(29,73,52,.18)] transition hover:bg-[#153b29] disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Signing in…" : `Sign in as ${role}`}</button>
    </form><p className="mt-7 text-center text-sm text-[#77827b]">Staff member without an account? <Link className="font-semibold text-[#1d4934] hover:underline" href="/signup">Create one</Link></p></div>;
}
