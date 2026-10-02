"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AuthShell, AuthStateIcon } from "@/app/components/auth-shell";
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
        <AuthStateIcon icon="alert" tone="neg" />
        <h1 className="m-0 text-[28px] font-semibold leading-tight tracking-[-.03em] text-[var(--text)]">Invalid link</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          This sign-in link is missing or incomplete. Request a new one from the login page.
        </p>
        <Link
          href="/magic-link"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-[var(--brand)] text-[14px] font-medium text-[var(--on-brand)] transition hover:bg-[var(--brand-strong)]"
        >
          Request new link
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <AuthStateIcon icon="clock" tone="warn" />
        <h1 className="m-0 text-[28px] font-semibold leading-tight tracking-[-.03em] text-[var(--text)]">Link expired</h1>
        <p role="alert" className="mt-2 text-sm text-[var(--neg)]">{error}</p>
        <Link
          href="/magic-link"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-[var(--brand)] text-[14px] font-medium text-[var(--on-brand)] transition hover:bg-[var(--brand-strong)]"
        >
          Request new link
        </Link>
        <div className="mt-4 text-center">
          <Link className="text-xs font-medium text-[var(--brand)] hover:underline" href="/login">
            Sign in with password
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full text-center">
      <h1 className="m-0 text-[24px] font-semibold tracking-[-.025em] text-[var(--text)]">Signing you in…</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {busy ? "Please wait while we verify your link." : "Redirecting…"}
      </p>
    </div>
  );
}

export default function MagicLinkVerifyPage() {
  return (
    <AuthShell mode="login">
      <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
        <MagicLinkVerifyContent />
      </Suspense>
    </AuthShell>
  );
}
