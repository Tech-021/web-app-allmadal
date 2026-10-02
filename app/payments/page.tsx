"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { useBusiness } from "@/app/components/business-context";
import { useToast } from "@/app/components/toast-context";
import { logActivity } from "@/app/lib/logger";
import { api } from "@/app/lib/api";
import { Icon, type IconName } from "@/app/components/icons";
import { Skeleton } from "@/app/components/motion";
import { PageHeader } from "@/app/components/page-layout";
import ui from "@/app/components/workspace-ui.module.css";
import billing from "./payments.module.css";

type BillingStatus = {
  success: boolean;
  status: string; // "trialing" | "active" | "past_due" | "canceled" | "expired";
  daysLeft: number;
  trialEndsAt: string;
  isTrialActive: boolean;
  isSubscribed: boolean;
  business?: {
    id: number;
    name: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    currentPeriodEnd?: string;
  };
};

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeBusiness, reloadBusinesses } = useBusiness();
  const { showToast } = useToast();

  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [checkoutLoading, setCheckoutLoading] = useState<boolean>(false);
  const [portalLoading, setPortalLoading] = useState<boolean>(false);
  const [billingData, setBillingData] = useState<BillingStatus | null>(null);

  const canceled = searchParams.get("payment") === "canceled";
  const paymentSuccess = searchParams.get("payment") === "success";

  const fetchStatus = async (showSyncNotice = false) => {
    if (!activeBusiness?.id) return;
    try {
      if (showSyncNotice) setSyncing(true);
      else setLoading(true);

      const res = await api<BillingStatus>(`/billing/status?businessId=${activeBusiness.id}`);
      setBillingData(res);
      await reloadBusinesses();
      if (showSyncNotice) {
        showToast("Subscription status updated from Stripe!", "success");
      }
    } catch (err: any) {
      console.error("Failed to load billing status:", err);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (activeBusiness?.id) {
      fetchStatus();
    }
  }, [activeBusiness?.id]);

  useEffect(() => {
    if (paymentSuccess) {
      showToast("Payment verified! Your Almadel Pro plan is now active.", "success");
      fetchStatus(false);
    } else if (canceled) {
      showToast("Payment checkout was canceled. You can try again anytime.", "info");
    }
  }, [paymentSuccess, canceled]);


  const handleProceedToCheckout = async () => {
    if (!activeBusiness?.id) {
      showToast("Please select a business first.", "error");
      return;
    }

    try {
      setCheckoutLoading(true);
      const successUrl = `${window.location.origin}/dashboard?payment=success`;
      const cancelUrl = `${window.location.origin}/payments?payment=canceled`;

      const response = await api<{ success: boolean; url: string }>("/billing/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({
          businessId: activeBusiness.id,
          successUrl,
          cancelUrl,
        }),
      });

      if (response.url) {
        logActivity(
          "PAYMENT_CHECKOUT_INITIATED",
          "Billing",
          `Initiated Stripe subscription checkout for business '${activeBusiness.name}'`,
          activeBusiness.name,
          { businessId: activeBusiness.id }
        );
        // Redirect directly to Stripe Hosted Checkout
        window.location.href = response.url;
      } else {
        showToast("Unable to initialize Stripe checkout. Please try again.", "error");
      }
    } catch (err: any) {
      console.error("Checkout session error:", err);
      showToast(err.message || "Failed to start Stripe checkout.", "error");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleOpenPortal = async () => {
    if (!activeBusiness?.id) return;
    try {
      setPortalLoading(true);
      const returnUrl = `${window.location.origin}/payments`;
      const res = await api<{ success: boolean; url: string }>("/billing/create-portal-session", {
        method: "POST",
        body: JSON.stringify({
          businessId: activeBusiness.id,
          returnUrl,
        }),
      });
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      console.error("Portal error:", err);
      showToast(err.message || "Unable to open billing portal.", "error");
    } finally {
      setPortalLoading(false);
    }
  };

  const isSubscribed = billingData?.isSubscribed || billingData?.status === "active";
  const daysLeft = billingData?.daysLeft ?? 30;
  const isTrial = !isSubscribed && (billingData?.isTrialActive ?? true);

  const statusTone = isSubscribed ? "pos" : isTrial ? "info" : "neg";
  const statusLabel = isSubscribed ? "Active" : isTrial ? "Free trial" : "Trial expired";
  const trialUsedPct = Math.min(100, Math.max(0, ((30 - daysLeft) / 30) * 100));
  const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

  return (
    <>
      <PageHeader
        eyebrow="Billing"
        title="Plan & billing"
        description="Your Almadel plan, trial status and secure Stripe billing."
        actions={
          <>
            <button
              type="button"
              onClick={() => fetchStatus(true)}
              disabled={syncing || loading}
              className={ui.secondary}
              title="Check and refresh live subscription status from Stripe"
            >
              <Icon name="refresh" size={14} className={syncing ? "[animation:almadelSpin_800ms_linear_infinite]" : ""} />
              {syncing ? "Syncing…" : "Sync status"}
            </button>
            {isSubscribed && (
              <button type="button" onClick={handleOpenPortal} disabled={portalLoading} className={ui.secondary}>
                <Icon name="invoice" size={14} />
                {portalLoading ? "Opening portal…" : "Invoices & cards"}
              </button>
            )}
          </>
        }
      />

      {/* Status */}
      <section className={`${ui.panel} ${ui.panelFlush}`} aria-busy={loading}>
        <div className={billing.status}>
          <div className={billing.statusMain}>
            {loading ? (
              <>
                <Skeleton className="h-5 w-24" />
                <Skeleton className="mt-4 h-7 w-3/4" />
                <Skeleton className="mt-3 h-4 w-2/3" />
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`${ui.chip} ${statusTone === "pos" ? ui.chipPos : statusTone === "info" ? ui.chipInfo : ui.chipNeg}`}>
                    <span className="size-1.5 rounded-full bg-current" />
                    {statusLabel}
                  </span>
                  <span className="text-[12.5px] text-[var(--muted)]">{activeBusiness?.name || "My Business"}</span>
                </div>
                <h2 className={billing.statusTitle}>
                  {isSubscribed ? (
                    "Almadel Pro is active"
                  ) : isTrial ? (
                    <>
                      <span className="font-mono">{daysLeft}</span> {daysLeft === 1 ? "day" : "days"} left in your free trial
                    </>
                  ) : (
                    "Your 30-day free trial has ended"
                  )}
                </h2>
                <p className={billing.statusText}>
                  {isSubscribed
                    ? "POS, financial accounts, khata, inventory and multi-staff management are fully unlocked."
                    : "Full, unrestricted access during your trial. Upgrade anytime with one flat price to keep your business running."}
                </p>
                {!isSubscribed && (
                  <div className={billing.meter} aria-label={`Trial ${Math.round(trialUsedPct)}% used`}>
                    <div className={billing.meterTrack}>
                      <span style={{ width: `${trialUsedPct}%` }} className={isTrial ? "" : billing.meterEnded} />
                    </div>
                    <div className={billing.meterLegend}>
                      <span>Day {Math.min(30, 30 - daysLeft)} of 30</span>
                      <span>{isTrial ? `Ends ${fmtDate(billingData?.trialEndsAt)}` : "Ended"}</span>
                    </div>
                  </div>
                )}
                {!isSubscribed && (
                  <div className="mt-5">
                    <button onClick={handleProceedToCheckout} disabled={checkoutLoading} className={`${ui.primary} ${ui.btnLg}`}>
                      <Icon name="card" size={15} />
                      {checkoutLoading ? "Redirecting to Stripe…" : "Upgrade with Stripe"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <dl className={`${ui.kv} ${billing.statusAside}`}>
            <div>
              <dt>Plan</dt>
              <dd>Almadel Pro</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{loading ? "…" : statusLabel}</dd>
            </div>
            <div>
              <dt>{isSubscribed ? "Renews on" : "Trial ends"}</dt>
              <dd className="font-mono">
                {loading ? "…" : isSubscribed ? fmtDate(billingData?.business?.currentPeriodEnd) : fmtDate(billingData?.trialEndsAt)}
              </dd>
            </div>
            <div>
              <dt>Price</dt>
              <dd className="font-mono">$29 / month</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Plan + assurance */}
      <div className={billing.grid}>
        <section className={`${ui.panel} ${ui.panelFlush}`}>
          <div className={billing.planHead}>
            <div>
              <span className={`${ui.chip} ${ui.chipPos}`}>All-in-one plan</span>
              <h2>Almadel Pro</h2>
              <p>One flat price with everything included.</p>
            </div>
            <div className={billing.price}>
              <strong>$29</strong>
              <span>/ month</span>
              <small>30-day free trial included</small>
            </div>
          </div>

          <ul className={billing.features}>
            {PLAN_FEATURES.map((f) => (
              <li key={f}>
                <span>
                  <Icon name="check" size={12} strokeWidth={2.2} />
                </span>
                {f}
              </li>
            ))}
          </ul>

          <div className={ui.sectionFooter}>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="card" size={13} />
                Visa · Mastercard · Amex
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="lock" size={13} />
                256-bit SSL
              </span>
            </p>
            <button onClick={handleProceedToCheckout} disabled={checkoutLoading || isSubscribed} className={isSubscribed ? ui.secondary : ui.primary}>
              {checkoutLoading ? (
                "Connecting to Stripe…"
              ) : isSubscribed ? (
                <>
                  <Icon name="check" size={14} />
                  Plan active
                </>
              ) : (
                <>
                  Proceed to Stripe checkout
                  <Icon name="arrowRight" size={14} />
                </>
              )}
            </button>
          </div>
        </section>

        <aside className={`${ui.panel} ${ui.panelFlush}`}>
          {ASSURANCES.map((a) => (
            <div key={a.title} className={billing.assure}>
              <span className={ui.metricIcon}>
                <Icon name={a.icon} size={14} />
              </span>
              <div>
                <h3>{a.title}</h3>
                <p>{a.body}</p>
              </div>
            </div>
          ))}
        </aside>
      </div>
    </>
  );
}

const PLAN_FEATURES = [
  "Fast point of sale (POS)",
  "Cash & bank accounts",
  "Customer udhaar / khata",
  "Supplier khata & payables",
  "Inventory & stock alerts",
  "IMEI / serial tracking",
  "Thermal & PDF invoices",
  "Staff roles & permissions",
  "Daily closing & shift reports",
  "Cloud backup & auto sync",
];

const ASSURANCES: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: "shield",
    title: "Bank-grade security",
    body: "Payments are processed on Stripe's PCI Level 1 certified infrastructure. Card details never touch our servers.",
  },
  {
    icon: "refresh",
    title: "Cancel anytime",
    body: "No long-term commitments or surprise fees. Pause or cancel from the customer portal.",
  },
  {
    icon: "info",
    title: "Need help with billing?",
    body: "Contact our 24/7 support team for billing questions or custom enterprise plans.",
  },
];

export default function PaymentsPage() {
  return (
    <WorkspaceShell>
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <PaymentContent />
      </Suspense>
    </WorkspaceShell>
  );
}
