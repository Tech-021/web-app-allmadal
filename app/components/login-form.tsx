"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Field } from "./auth-shell";
import { UserRole, useAuth } from "@/hooks/useAuth";

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [role, setRole] = useState<UserRole>("staff");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const user = await login({
        email: String(form.get("email")),
        password: String(form.get("password")),
        role,
      });
      router.push(`/dashboard?role=${user.role}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <h1 className="text-[2rem] font-extrabold tracking-[-.035em] text-[#111827]">Welcome back</h1>
      <p className="mt-1.5 text-sm text-[#6b7280]">Apni Dukaan Ko Asaan Banayein. Enter credentials to continue.</p>

      <div className="mt-7 grid grid-cols-2 gap-1 rounded-2xl bg-[#f3f4f6] p-1" role="group" aria-label="Select account role">
        {(["staff", "admin"] as UserRole[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setRole(item)}
            className={`rounded-xl px-4 py-2.5 text-xs font-extrabold capitalize transition-all duration-200 ${
              role === item ? "bg-white text-[#00875A] shadow-sm" : "text-[#6b7280] hover:text-[#111827]"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <form className="mt-6 space-y-4.5" onSubmit={submit}>
        <Field label="Email address" name="email" type="email" placeholder="you@almadel.com" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type={show ? "text" : "password"}
          placeholder="Enter your password"
          autoComplete="current-password"
          minLength={8}
          required
          right={
            <button
              className="absolute inset-y-0 right-0 px-4 text-xs font-bold text-[#6b7280] transition hover:text-[#00875A]"
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? "Hide" : "Show"}
            </button>
          }
        />

        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 font-medium text-[#4b5563] cursor-pointer">
            <input className="accent-[#00875A] rounded" type="checkbox" /> Remember me
          </label>
          <Link className="font-bold text-[#00875A] transition hover:underline" href="/forgot-password">
            Forgot Password?
          </Link>
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-semibold text-red-700">
            {error}
          </p>
        )}

        <button
          disabled={busy}
          className="h-12.5 w-full rounded-full bg-[#00875A] font-extrabold text-white shadow-[0_8px_20px_rgba(0,135,90,.22)] transition-all duration-200 hover:bg-[#006b3f] hover:shadow-[0_10px_24px_rgba(0,135,90,.3)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 text-sm tracking-wide"
        >
          {busy ? "Signing in…" : `Login Karein (${role})`}
        </button>
      </form>

      <p className="mt-7 text-center text-xs font-medium text-[#6b7280]">
        Staff member without an account?{" "}
        <Link className="font-bold text-[#00875A] hover:underline" href="/signup">
          Naya Account Banayein
        </Link>
      </p>
    </div>
  );
}
