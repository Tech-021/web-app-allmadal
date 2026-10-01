"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AuthShell } from "@/app/components/auth-shell";
import { isRememberAuthPreferred } from "@/app/lib/auth-session";
import { useAuth } from "@/hooks/useAuth";

function MagicLinkVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const { loginWithMagicLink } = useAuth();

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(Boolean(token));
  const attempted = useRef(false);

  useEffect(() => {
    if (!token) return;
    if (attempted.current) return;
    attempted.current = true;

    void (async () => {
      try {
        const user = await loginWithMagicLink(token, {
          rememberMe: isRememberAuthPreferred(),
        });
        if (user.role === "pending") {
          router.replace("/setup-business");
        } else {
          router.replace("/dashboard");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not sign in with this link.");
        setBusy(false);
      }
    })();
  }, [token, loginWithMagicLink, router]);

  if (!token) {
    return (
      <div className="w-full">
        <h1 className="text-[2rem] font-extrabold tracking-[-.035em] text-[#111827]">Invalid link</h1>
        <p className="mt-2 text-sm text-[#6b7280]">
          This sign-in link is missing or incomplete. Request a new one from the login page.
        </p>
        <Link
          href="/magic-link"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#00875A] font-bold text-white shadow-md transition hover:bg-[#006b3f]"
        >
          Request new link
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <h1 className="text-[2rem] font-extrabold tracking-[-.035em] text-[#111827]">Link expired</h1>
        <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>
        <Link
          href="/magic-link"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#00875A] font-bold text-white shadow-md transition hover:bg-[#006b3f]"
        >
          Request new link
        </Link>
        <div className="mt-4 text-center">
          <Link className="text-xs font-bold text-[#00875A] hover:underline" href="/login">
            Sign in with password
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full text-center">
      <h1 className="text-2xl font-extrabold text-[#111827]">Signing you in…</h1>
      <p className="mt-2 text-sm text-[#6b7280]">
        {busy ? "Please wait while we verify your link." : "Redirecting…"}
      </p>
    </div>
  );
}

export default function MagicLinkVerifyPage() {
  return (
    <AuthShell mode="login">
      <Suspense fallback={<p className="text-sm text-[#6b7280]">Loading…</p>}>
        <MagicLinkVerifyContent />
      </Suspense>
    </AuthShell>
  );
}
