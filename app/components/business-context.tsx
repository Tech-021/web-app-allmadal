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
  ownerId?: number;
  membershipRole?: "owner" | "admin" | "staff";
};

interface BusinessContextValue {
  businesses: Business[];
  activeBusiness: Business | null;
  isLoading: boolean;
  switchBusiness: (businessId: number) => void;
  reloadBusinesses: () => Promise<Business[]>;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);
const ACTIVE_BIZ_KEY = "almadel_active_business_id";

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      } else {
        localStorage.removeItem(ACTIVE_BIZ_KEY);
      }

      setIsLoading(false);
      return list;
    } catch {
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
        window.dispatchEvent(new CustomEvent("almadel_business_switched", { detail: selected }));
      }
    },
    [businesses]
  );

  const value = useMemo(
    () => ({
      businesses,
      activeBusiness,
      isLoading,
      switchBusiness,
      reloadBusinesses,
    }),
    [businesses, activeBusiness, isLoading, switchBusiness, reloadBusinesses]
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
