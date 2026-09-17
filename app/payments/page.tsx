"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { useBusiness } from "@/app/components/business-context";
import { useToast } from "@/app/components/toast-context";
import { api } from "@/app/lib/api";

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
  const { activeBusiness } = useBusiness();
  const { showToast } = useToast();

  const [loading, setLoading] = useState<boolean>(true);
  const [checkoutLoading, setCheckoutLoading] = useState<boolean>(false);
  const [portalLoading, setPortalLoading] = useState<boolean>(false);
  const [billingData, setBillingData] = useState<BillingStatus | null>(null);

  const canceled = searchParams.get("payment") === "canceled";

  const fetchStatus = async () => {
    if (!activeBusiness?.id) return;
    try {
      setLoading(true);
      const res = await api<BillingStatus>(`/billing/status?businessId=${activeBusiness.id}`);
      setBillingData(res);
    } catch (err: any) {
      console.error("Failed to load billing status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeBusiness?.id) {
      fetchStatus();
    }
  }, [activeBusiness?.id]);

  useEffect(() => {
    if (canceled) {
      showToast("Payment checkout was canceled. You can try again anytime.", "info");
    }
  }, [canceled]);

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

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 mb-2">
            <span>🛡️</span> Verified Stripe Checkout
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Payments & Subscription
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage your store plan, 30-day trial status, and secure Stripe billing.
          </p>
        </div>

        {isSubscribed && (
          <button
            onClick={handleOpenPortal}
            disabled={portalLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <span>📄</span> {portalLoading ? "Opening Portal..." : "Manage Invoices & Cards"}
          </button>
        )}
      </div>

      {/* Trial / Subscription Status Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-900 to-teal-900 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                {isSubscribed ? "Active Pro Subscriber" : isTrial ? "Free Trial Period" : "Trial Expired"}
              </span>
              <span className="text-xs text-emerald-200/80">• {activeBusiness?.name || "My Business"}</span>
            </div>
            <h2 className="text-2xl font-bold">
              {isSubscribed
                ? "Your Almadel Pro Plan is Active"
                : isTrial
                ? `You have ${daysLeft} days remaining in your Free Trial`
                : "Your 30-Day Free Trial Has Expired"}
            </h2>
            <p className="text-sm text-emerald-100/80 max-w-xl">
              {isSubscribed
                ? "All features including POS, Financial Accounts, Khata, Inventory, and multi-staff management are fully unlocked."
                : "Enjoy full unrestricted access during your 30-day trial. Upgrade at any time with single flat pricing to keep your business running smoothly."}
            </p>
          </div>

          {!isSubscribed && (
            <div className="shrink-0">
              <button
                onClick={handleProceedToCheckout}
                disabled={checkoutLoading}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-sm text-emerald-950 bg-emerald-400 hover:bg-emerald-300 transition-all shadow-lg hover:shadow-emerald-500/20 hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                <span>💳</span>
                {checkoutLoading ? "Redirecting to Stripe..." : "Upgrade with Stripe"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Pricing & Plan Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Main Plan Card */}
        <div className="md:col-span-2 rounded-2xl border-2 border-emerald-600 bg-white p-6 sm:p-8 shadow-sm space-y-6 relative">
          <div className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-black uppercase tracking-wider">
            All-In-One Pro Plan
          </div>

          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-slate-100 pb-6">
            <div>
              <h3 className="text-xl font-black text-slate-900">Almadel Pro Subscription</h3>
              <p className="text-sm text-slate-500 mt-0.5">Single flat price with everything included.</p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-3xl sm:text-4xl font-black text-slate-900">$29</span>
              <span className="text-sm font-semibold text-slate-500"> / month</span>
              <p className="text-xs text-emerald-700 font-semibold mt-0.5">30-Day Free Trial Included</p>
            </div>
          </div>

          {/* Features List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm text-slate-700">
            <div className="flex items-center gap-2.5">
              <span className="text-emerald-600 font-bold">✓</span> Fast Point of Sale (POS)
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-emerald-600 font-bold">✓</span> Full Financial Cash & Bank Accounts
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-emerald-600 font-bold">✓</span> Customer Udhaar / Khata System
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-emerald-600 font-bold">✓</span> Supplier Khata & Purchases
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-emerald-600 font-bold">✓</span> Inventory & Stock Alerts
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-emerald-600 font-bold">✓</span> IMEI / Serial Number Tracking
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-emerald-600 font-bold">✓</span> Thermal & PDF Invoices
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-emerald-600 font-bold">✓</span> Multi-Staff Roles & Permissions
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-emerald-600 font-bold">✓</span> Daily Closing & Shift Reports
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-emerald-600 font-bold">✓</span> Cloud Backup & Auto Sync
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>💳 Visa</span>
              <span>💳 Mastercard</span>
              <span>💳 Amex</span>
              <span>🔒 256-Bit SSL</span>
            </div>

            <button
              onClick={handleProceedToCheckout}
              disabled={checkoutLoading || isSubscribed}
              className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-md ${
                isSubscribed
                  ? "bg-slate-100 text-slate-400 cursor-default"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-emerald-600/20 hover:-translate-y-0.5"
              }`}
            >
              {checkoutLoading
                ? "Connecting to Stripe..."
                : isSubscribed
                ? "✓ Plan Active"
                : "Proceed to Stripe Checkout →"}
            </button>
          </div>
        </div>

        {/* Security & FAQ Sidebar Card */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>🔒</span> Bank-Grade Security
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              All payment transactions are encrypted and processed directly on Stripe’s PCI Service Provider Level 1 certified infrastructure. Your card credentials never touch our servers.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>🔄</span> Cancel Anytime
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              No long-term commitments or surprise fees. You can pause or cancel your subscription whenever you want directly via the customer portal.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200/60 shadow-xs space-y-2">
            <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
              Need Help with Billing?
            </h4>
            <p className="text-xs text-emerald-800">
              Contact our 24/7 support team for billing inquiries or custom enterprise plans.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <WorkspaceShell>
      <Suspense fallback={<div className="p-8 text-center text-slate-500 font-medium">Loading payment information...</div>}>
        <PaymentContent />
      </Suspense>
    </WorkspaceShell>
  );
}
