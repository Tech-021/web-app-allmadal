"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/app/lib/api";

export type Business = {
  id: number;
  name: string;
  businessType: string;
  businessCategory?: string | null;
  mobileNumber: string;
  whatsappNumber?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  area?: string | null;
  province?: string | null;
  accountingStartDate?: string | null;
  openingCashBalance?: number;
  openingBankBalance?: number;
  hasCustomerUdhaar?: boolean;
  customerReceivable?: number;
  hasSupplierUdhaar?: boolean;
  supplierPayable?: number;
  manageStock?: boolean;
  allowDiscounts?: boolean;
  currentStockValue?: number;
  taxRegistered?: string;
  ntn?: string | null;
  strn?: string | null;
  taxBusinessName?: string | null;
  logoUrl?: string | null;
  workspaceMode?: "pos" | "financial" | string;
  ownerId?: number;
  membershipRole?: "owner" | "admin" | "staff" | "accountant";
  subscriptionStatus?: string;
  trialEndsAt?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  currentPeriodEnd?: string | null;
  isTrial?: boolean;
  isTrialExpired?: boolean;
  trialDaysRemaining?: number;
};

export type WorkspaceMode = "pos" | "financial";

interface BusinessContextValue {
  businesses: Business[];
  activeBusiness: Business | null;
  workspaceMode: WorkspaceMode;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  isLoading: boolean;
  switchBusiness: (businessId: number) => void;
  reloadBusinesses: (options?: { skipWorkspaceModeSync?: boolean }) => Promise<Business[]>;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);
const ACTIVE_BIZ_KEY = "almadel_active_business_id";

function modeFromBusiness(business: Business | null | undefined): WorkspaceMode {
  return business?.workspaceMode === "financial" ? "financial" : "pos";
}

/** Remove legacy client caches that used to fight the server (especially workspace mode). */
function purgeClientCaches() {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key === "almadel_workspace_mode" ||
          key.startsWith("almadel_pos_cache_") ||
          key.startsWith("almadel_offline_sales_queue_") ||
          key.startsWith("almadel_cached_") ||
          key.startsWith("almadel_custom_categories"))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn("Could not clean legacy cache keys:", err);
  }
}

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null);
  const [workspaceMode, setWorkspaceModeState] = useState<WorkspaceMode>("pos");
  const [isLoading, setIsLoading] = useState(true);
  const businessesRef = React.useRef<Business[]>([]);
  businessesRef.current = businesses;

  useEffect(() => {
    purgeClientCaches();
  }, []);

  const applyBusinessMode = useCallback((business: Business | null) => {
    const mode = modeFromBusiness(business);
    setWorkspaceModeState(mode);
    return mode;
  }, []);

  const setWorkspaceMode = useCallback(
    (mode: WorkspaceMode) => {
      setWorkspaceModeState(mode);

      const businessId = activeBusiness?.id;
      if (businessId) {
        setActiveBusiness((prev) => (prev ? { ...prev, workspaceMode: mode } : prev));
        setBusinesses((prev) =>
          prev.map((b) => (b.id === businessId ? { ...b, workspaceMode: mode } : b)),
        );
        void api(`/business/${businessId}`, {
          method: "PATCH",
          body: JSON.stringify({ workspaceMode: mode }),
        }).catch((err) => {
          console.warn("Failed to persist workspaceMode:", err);
        });
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("almadel_mode_switched", { detail: mode }));
      }
    },
    [activeBusiness?.id],
  );

  const reloadBusinesses = useCallback(
    async (options?: { skipWorkspaceModeSync?: boolean }): Promise<Business[]> => {
      if (!isAuthenticated) {
        setBusinesses([]);
        setActiveBusiness(null);
        setWorkspaceModeState("pos");
        setIsLoading(false);
        return [];
      }

      try {
        const res = await api<{ success: boolean; businesses: Business[] }>("/business/my-businesses");
        const list = res.businesses || [];
        setBusinesses(list);
        businessesRef.current = list;

        const savedId = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_BIZ_KEY) : null;
        let target: Business | null = null;

        if (savedId) {
          target = list.find((b) => String(b.id) === savedId) || null;
        }
        if (!target && list.length > 0) {
          target = list[0];
        }

        setActiveBusiness(target);
        if (target) {
          localStorage.setItem(ACTIVE_BIZ_KEY, String(target.id));
          if (!options?.skipWorkspaceModeSync) {
            applyBusinessMode(target);
          }
        } else {
          localStorage.removeItem(ACTIVE_BIZ_KEY);
          setWorkspaceModeState("pos");
        }

        setIsLoading(false);
        return list;
      } catch (err) {
        console.error("Failed to load businesses from server:", err);
        setBusinesses([]);
        setActiveBusiness(null);
        setIsLoading(false);
        return [];
      }
    },
    [isAuthenticated, applyBusinessMode],
  );

  useEffect(() => {
    if (!authLoading) {
      void reloadBusinesses();
    }
  }, [authLoading, reloadBusinesses]);

  const switchBusiness = useCallback(
    (businessId: number) => {
      const selected = businessesRef.current.find((b) => b.id === businessId);
      if (!selected) {
        return;
      }

      setActiveBusiness(selected);
      localStorage.setItem(ACTIVE_BIZ_KEY, String(selected.id));
      applyBusinessMode(selected);
      window.dispatchEvent(new CustomEvent("almadel_business_switched", { detail: selected }));
    },
    [applyBusinessMode],
  );

  const value = useMemo(
    () => ({
      businesses,
      activeBusiness,
      workspaceMode,
      setWorkspaceMode,
      isLoading,
      switchBusiness,
      reloadBusinesses,
    }),
    [businesses, activeBusiness, workspaceMode, setWorkspaceMode, isLoading, switchBusiness, reloadBusinesses],
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error("useBusiness must be used within a BusinessProvider");
  }
  return context;
}
