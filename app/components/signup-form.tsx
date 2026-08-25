"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "./auth-shell";
import { useAuth } from "@/hooks/useAuth";

export function SignupForm() {
  const router = useRouter();
  const { signup } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== form.get("confirmPassword")) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await signup({ name: String(form.get("name")), email: String(form.get("email")), password });
      router.push("/dashboard?role=staff");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create your account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <h1 className="text-[2rem] font-extrabold tracking-[-.035em] text-[#111827]">Naya Account Banayein</h1>
      <p className="mt-1.5 text-sm leading-6 text-[#6b7280]">
        Join the Almadel workspace. Administrator accounts are managed directly by system admins.
      </p>

      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[#c3e9d7] bg-[#e6f4ed] px-4 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#00875A] text-xs font-extrabold text-white">
          S
        </span>
        <div>
          <p className="text-xs font-bold text-[#111827]">Staff Registration</p>
          <p className="text-[11px] font-medium text-[#006b3f]">Your account will be assigned the staff role.</p>
        </div>
      </div>

      <form className="mt-6 space-y-4" onSubmit={submit}>
        <Field label="Full name" name="name" placeholder="Your full name" autoComplete="name" minLength={2} required />
        <Field label="Email address" name="email" type="email" placeholder="you@almadel.com" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type={show ? "text" : "password"}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          minLength={8}
          required
          right={
            <button
              className="absolute inset-y-0 right-0 px-4 text-xs font-bold text-[#6b7280] hover:text-[#00875A]"
              type="button"
              onClick={() => setShow(!show)}
            >
              {show ? "Hide" : "Show"}
            </button>
          }
        />
        <Field label="Confirm password" name="confirmPassword" type={show ? "text" : "password"} placeholder="Repeat your password" autoComplete="new-password" minLength={8} required />

        <label className="flex items-start gap-2.5 text-xs leading-5 font-medium text-[#6b7280] cursor-pointer">
          <input className="mt-0.5 accent-[#00875A] rounded" type="checkbox" required />
          <span>I agree to the Terms of Service and Privacy Policy.</span>
        </label>

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-semibold text-red-700">
            {error}
          </p>
        )}

        <button
          disabled={busy}
          className="h-12.5 w-full rounded-full bg-[#00875A] font-extrabold text-white shadow-[0_8px_20px_rgba(0,135,90,.22)] transition-all duration-200 hover:bg-[#006b3f] hover:shadow-[0_10px_24px_rgba(0,135,90,.3)] active:scale-[0.99] disabled:opacity-60 text-sm tracking-wide"
        >
          {busy ? "Creating account…" : "Naya Account Banayein"}
        </button>
      </form>
    </div>
  );
}

