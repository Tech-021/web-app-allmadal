"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
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
  reloadBusinesses: () => Promise<Business[]>;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);
const ACTIVE_BIZ_KEY = "almadel_active_business_id";
const WORKSPACE_MODE_KEY = "almadel_workspace_mode";

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null);
  const [workspaceMode, setWorkspaceModeState] = useState<WorkspaceMode>("financial");
  const [isLoading, setIsLoading] = useState(true);

  // Initialize workspace mode from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedMode = localStorage.getItem(WORKSPACE_MODE_KEY) as WorkspaceMode | null;
      if (savedMode === "pos" || savedMode === "financial") {
        setWorkspaceModeState(savedMode);
      }
    }
  }, []);

  const setWorkspaceMode = useCallback((mode: WorkspaceMode) => {
    setWorkspaceModeState(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem(WORKSPACE_MODE_KEY, mode);
      window.dispatchEvent(new CustomEvent("almadel_mode_switched", { detail: mode }));
    }
  }, []);

  const reloadBusinesses = useCallback(async (): Promise<Business[]> => {
    if (!isAuthenticated) {
      setBusinesses([]);
      setActiveBusiness(null);
      setIsLoading(false);
      return [];
    }

    try {
      const res = await api<{ success: boolean; businesses: Business[] }>("/business/my-businesses");
      const list = res.businesses || [];
      setBusinesses(list);
      if (typeof window !== "undefined") {
        localStorage.setItem("almadel_cached_businesses", JSON.stringify(list));
      }

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
        localStorage.setItem("almadel_cached_active_business", JSON.stringify(target));
        const resolvedMode: WorkspaceMode =
          target.workspaceMode === "financial" ? "financial" : "pos";
        setWorkspaceModeState(resolvedMode);
        localStorage.setItem(WORKSPACE_MODE_KEY, resolvedMode);
      } else {
        localStorage.removeItem(ACTIVE_BIZ_KEY);
      }

      setIsLoading(false);
      return list;
    } catch {
      // Offline fallback: restore cached active business & list
      if (typeof window !== "undefined") {
        try {
          const cachedBizStr = localStorage.getItem("almadel_cached_active_business");
          const cachedListStr = localStorage.getItem("almadel_cached_businesses");
          if (cachedBizStr) {
            const cachedBiz = JSON.parse(cachedBizStr) as Business;
            setActiveBusiness(cachedBiz);
          }
          if (cachedListStr) {
            const cachedList = JSON.parse(cachedListStr) as Business[];
            setBusinesses(cachedList);
          }
        } catch (e) {
          console.warn("Failed to load cached offline business:", e);
        }
      }
      setIsLoading(false);
      return [];
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authLoading) {
      void reloadBusinesses();
    }
  }, [authLoading, reloadBusinesses]);

  const switchBusiness = useCallback(
    (businessId: number) => {
      const selected = businesses.find((b) => b.id === businessId);
      if (selected) {
        setActiveBusiness(selected);
        localStorage.setItem(ACTIVE_BIZ_KEY, String(selected.id));
        const resolvedMode: WorkspaceMode =
          selected.workspaceMode === "financial" ? "financial" : "pos";
        setWorkspaceModeState(resolvedMode);
        localStorage.setItem(WORKSPACE_MODE_KEY, resolvedMode);
        window.dispatchEvent(new CustomEvent("almadel_business_switched", { detail: selected }));
      }
    },
    [businesses]
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
    [businesses, activeBusiness, workspaceMode, setWorkspaceMode, isLoading, switchBusiness, reloadBusinesses]
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
