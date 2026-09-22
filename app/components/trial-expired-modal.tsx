"use client";

import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness, Business } from "@/app/components/business-context";
import { useToast } from "@/app/components/toast-context";
import { api } from "@/app/lib/api";
import { logActivity } from "@/app/lib/logger";

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
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-md animate-fadeIn"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="trial-expired-title"
      aria-describedby="trial-expired-desc"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden text-center p-6 sm:p-8">
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-[#00875a] to-emerald-600" />

        {/* Lock Icon */}
        <div className="mx-auto size-16 sm:size-20 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center text-3xl sm:text-4xl shadow-inner mb-5">
          🔒
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 mb-3">
          30-Day Free Trial Ended
        </span>

        <h2
          id="trial-expired-title"
          className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight"
        >
          Your Free Trial Has Ended
        </h2>

        <p
          id="trial-expired-desc"
          className="mt-2 text-sm sm:text-base text-gray-600 font-medium max-w-md mx-auto leading-relaxed"
        >
          Your 30-day free trial for <strong className="text-gray-900">{business.name}</strong> has expired. Kindly make payment to continue managing your inventory, sales, and accounts.
        </p>

        {/* Feature List */}
        <div className="my-6 text-left bg-gray-50/80 rounded-2xl p-4 border border-gray-100 space-y-2.5">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">
            Subscription Includes:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold text-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-[#00875a]">✓</span> POS & Thermal Receipts
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#00875a]">✓</span> Inventory & IMEI Khata
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#00875a]">✓</span> Customers & Udhaar Ledger
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#00875a]">✓</span> Profit & Loss Balance Sheets
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#00875a]">✓</span> Accountant & Staff Roles
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#00875a]">✓</span> Real-Time Cloud Sync
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={handlePayNow}
          disabled={loading}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#00875a] to-[#006644] hover:from-[#00744e] hover:to-[#005236] text-white font-extrabold text-base sm:text-lg shadow-lg shadow-[#00875a]/25 hover:shadow-xl hover:shadow-[#00875a]/30 transition transform active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg
                className="animate-spin size-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                ></path>
              </svg>
              <span>Connecting to Stripe...</span>
            </>
          ) : (
            <>
              <span>Proceed to Stripe Checkout</span>
              <span className="text-xl">💳 →</span>
            </>
          )}
        </button>

        <p className="text-[11px] text-gray-400 font-semibold mt-2.5">
          🔒 Secure 256-bit encrypted checkout powered by Stripe
        </p>

        {/* Alternative Actions */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-gray-500">
          {otherBusinesses.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span>Switch store:</span>
              {otherBusinesses.map((ob) => (
                <button
                  key={ob.id}
                  onClick={() => switchBusiness(ob.id)}
                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition"
                >
                  {ob.name}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={async () => {
              await logout();
              window.location.href = "/login";
            }}
            className="text-red-600 hover:text-red-700 hover:underline"
          >
            Sign out of account
          </button>
        </div>
      </div>
    </div>
  );
}
