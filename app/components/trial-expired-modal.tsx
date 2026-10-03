"use client";

import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness, Business } from "@/app/components/business-context";
import { useToast } from "@/app/components/toast-context";
import { api } from "@/app/lib/api";
import { logActivity } from "@/app/lib/logger";
import { Icon } from "@/app/components/icons";
import ui from "@/app/components/workspace-ui.module.css";
import { Overlay } from "@/app/components/overlay";

interface TrialExpiredModalProps {
  business: Business;
}

export function TrialExpiredModal({ business }: TrialExpiredModalProps) {
  const { logout, user } = useAuth();
  const { businesses, switchBusiness } = useBusiness();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handlePayNow = async () => {
    try {
      setLoading(true);
      const successUrl = `${window.location.origin}/dashboard?payment=success`;
      const cancelUrl = `${window.location.origin}/dashboard?payment=canceled`;

      const response = await api<{ success: boolean; url: string }>(
        "/billing/create-checkout-session",
        {
          method: "POST",
          body: JSON.stringify({
            businessId: business.id,
            successUrl,
            cancelUrl,
          }),
        }
      );

      if (response.url) {
        logActivity(
          "PAYMENT_TRIAL_EXPIRED_CHECKOUT",
          "Billing",
          `User initiated payment after trial expiration for store '${business.name}'`,
          business.name,
          { businessId: business.id }
        );
        window.location.href = response.url;
      } else {
        showToast("Unable to start checkout. Please try again or contact support.", "error");
        setLoading(false);
      }
    } catch (err: any) {
      console.error("Payment initiation error:", err);
      showToast(err.message || "Failed to initialize payment gateway.", "error");
      setLoading(false);
    }
  };

  const otherBusinesses = businesses.filter(
    (b) => b.id !== business.id && !b.isTrialExpired
  );

  return (
    <Overlay
      open
      dismissible={false}
      className="al-overlay fixed inset-0 z-[99999] flex items-end justify-center bg-[var(--scrim)] p-0 backdrop-blur-[4px] sm:items-center sm:p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="trial-expired-title"
      aria-describedby="trial-expired-desc"
    >
      <div className="relative w-full max-w-[480px] overflow-hidden rounded-t-[20px] border border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-lg)] sm:rounded-[18px]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--warn)_50%,transparent)] opacity-70" />

        <div className="px-6 pb-5 pt-7 text-center sm:px-8">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-[14px] border border-[color-mix(in_oklab,var(--warn)_25%,transparent)] bg-[var(--warn-soft)] text-[var(--warn)]">
            <Icon name="lock" size={20} />
          </span>
          <span className={`${ui.chip} ${ui.chipWarn}`}>
            <Icon name="clock" size={11} />
            30-day free trial ended
          </span>
          <h2 id="trial-expired-title" className="mb-1.5 mt-3.5 text-[22px] font-semibold tracking-[-0.03em] text-[var(--text)]">
            Your free trial has ended
          </h2>
          <p id="trial-expired-desc" className="mx-auto m-0 max-w-[42ch] text-[13.5px] leading-relaxed text-[var(--muted)]">
            The trial for <strong className="font-medium text-[var(--text)]">{business.name}</strong> has expired. Subscribe to keep managing your
            inventory, sales and accounts — your data is safe and waiting.
          </p>
        </div>

        <ul className="m-0 grid list-none grid-cols-1 gap-x-6 gap-y-2.5 border-y border-[var(--border)] bg-[var(--surface-2)] px-6 py-4 sm:grid-cols-2 sm:px-8">
          {INCLUDED.map((f) => (
            <li key={f} className="flex items-center gap-2.5 text-[12.5px] text-[var(--text-2)]">
              <span className="grid size-[18px] shrink-0 place-items-center rounded-[5px] bg-[var(--brand-soft)] text-[var(--brand)]">
                <Icon name="check" size={11} strokeWidth={2.2} />
              </span>
              {f}
            </li>
          ))}
        </ul>

        <div className="px-6 pb-[calc(20px+env(safe-area-inset-bottom))] pt-5 sm:px-8 sm:pb-6">
          <button type="button" onClick={handlePayNow} disabled={loading} className={`${ui.primary} ${ui.btnLg} w-full`}>
            {loading ? (
              <>
                <span className="size-4 rounded-full border-2 border-current border-t-transparent [animation:almadelSpin_700ms_linear_infinite]" />
                Connecting to Stripe…
              </>
            ) : (
              <>
                <Icon name="card" size={16} />
                Subscribe with Stripe · $29 / month
              </>
            )}
          </button>
          <p className="mb-0 mt-2.5 flex items-center justify-center gap-1.5 text-[12px] text-[var(--faint)]">
            <Icon name="lock" size={12} />
            Secure 256-bit encrypted checkout
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-[var(--border)] pt-4 text-[12.5px] text-[var(--muted)]">
            {otherBusinesses.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span>Switch store:</span>
                {otherBusinesses.map((ob) => (
                  <button key={ob.id} onClick={() => switchBusiness(ob.id)} className={`${ui.secondary} ${ui.btnSm}`}>
                    <Icon name="store" size={12} />
                    {ob.name}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={async () => {
                await logout();
                showToast("You have been signed out.", "success");
                window.location.href = "/login";
              }}
              className="inline-flex items-center gap-1.5 rounded-[7px] px-2 py-1 font-medium text-[var(--neg)] transition-colors hover:bg-[var(--neg-soft)]"
            >
              <Icon name="logout" size={13} />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

const INCLUDED = [
  "POS & thermal receipts",
  "Inventory & IMEI khata",
  "Customers & udhaar ledger",
  "Profit & loss, balance sheets",
  "Accountant & staff roles",
  "Real-time cloud sync",
];
