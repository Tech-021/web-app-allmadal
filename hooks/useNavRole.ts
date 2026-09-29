"use client";

import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/app/components/business-context";
import { effectiveNavRole, type NavRole } from "@/app/lib/access";

/** Server-backed nav role: membership on the active business, not editable localStorage role. */
export function useNavRole(): NavRole {
  const { user } = useAuth();
  const { activeBusiness } = useBusiness();

  return useMemo(
    () => effectiveNavRole(user?.role, activeBusiness?.membershipRole),
    [user?.role, activeBusiness?.membershipRole],
  );
}
