import { businessKey, getAuthItem, handleApiUnauthorizedStatus, tokenKey } from "@/app/lib/auth-session";
import { devError, devLog, devWarn } from "@/app/lib/dev-console";

export type ActivityAction =
  | "PRODUCT_CREATE"
  | "PRODUCT_UPDATE"
  | "PRODUCT_DELETE"
  | "BULK_PRODUCT_DELETE"
  | "PRODUCT_CSV_IMPORT"
  | "PRODUCT_CSV_EXPORT"
  | "STOCK_UPDATE"
  | "CATEGORY_CREATE"
  | "CATEGORY_UPDATE"
  | "CATEGORY_DELETE"
  | "CUSTOMER_CREATE"
  | "CUSTOMER_UPDATE"
  | "CUSTOMER_DELETE"
  | "SUPPLIER_CREATE"
  | "SUPPLIER_UPDATE"
  | "SUPPLIER_DELETE"
  | "EXPENSE_CREATE"
  | "EXPENSE_UPDATE"
  | "EXPENSE_DELETE"
  | "ACCOUNT_CREATE"
  | "ACCOUNT_UPDATE"
  | "ACCOUNT_DELETE"
  | "SALE_CREATE"
  | "DAILY_CLOSING_RECORD"
  | "SETTINGS_UPDATE"
  | "PAYMENT_CHECKOUT_INITIATED"
  | "PAYMENT_TRIAL_EXPIRED_CHECKOUT"
  | "STRIPE_TRIAL_CHECKOUT_INITIATED"
  | "BUSINESS_CREATE"
  | "FINANCIAL_SETUP_COMPLETE"
  | "STAFF_CREATE"
  | "STAFF_UPDATE"
  | "STAFF_DELETE"
  | "AUTH_LOGIN"
  | "AUTH_LOGOUT"
  | "AUTH_SIGNUP"
  | "PAGE_VISIT";

export type ActivityCategory =
  | "Product"
  | "Stock"
  | "Category"
  | "Customer"
  | "Supplier"
  | "Expense"
  | "Account"
  | "Finance"
  | "Sales"
  | "Settings"
  | "Billing"
  | "Staff"
  | "Auth"
  | "Visit";

export type ActivityLog = {
  id: string;
  timestamp: string;
  action: ActivityAction;
  category: ActivityCategory;
  user: {
    id?: number | null;
    name: string;
    email: string;
    role: "admin" | "staff" | "accountant" | "system";
  };
  details: string;
  target?: string;
  meta?: Record<string, unknown>;
};

let lastVisitTarget = "";
let lastVisitTime = 0;

/** Event payload only — actor identity is derived on the server from the JWT. */
export type ActivityLogPayload = {
  action: ActivityAction;
  category: ActivityCategory;
  details: string;
  target?: string | null;
  meta?: Record<string, unknown>;
};

/**
 * Persists an activity log to the backend. Requires a valid session token.
 */
export async function logActivity(
  action: ActivityAction,
  category: ActivityCategory,
  details: string,
  target?: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  if (typeof window === "undefined") return;

  if (action === "PAGE_VISIT") {
    const now = Date.now();
    if (lastVisitTarget === target && now - lastVisitTime < 3000) {
      return;
    }
    lastVisitTarget = target || "";
    lastVisitTime = now;
  }

  const token = getAuthItem(tokenKey);
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");

  if (!baseUrl) {
    devWarn("%c[Almadel Logger]%c NEXT_PUBLIC_BACKEND_URL is not set in .env!", "color: #e11d48; font-weight: bold", "color: inherit");
    return;
  }

  if (!token) {
    devWarn("[Almadel Logger] Skipping log — no session token (actor cannot be verified server-side).");
    return;
  }

  const payload: ActivityLogPayload = {
    action,
    category,
    details,
    target: target || null,
    meta: meta || {},
  };

  const activeBusinessId = getAuthItem(businessKey);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  if (activeBusinessId) {
    headers["x-business-id"] = activeBusinessId;
  }

  devLog(
    `%c[Almadel Logger] 📤 Sending Log Event -> %c${action} (${category})`,
    "color: #0284c7; font-weight: bold",
    "color: #0f172a; font-weight: 600",
    { url: `${baseUrl}/logs`, payload },
  );

  try {
    let res = await fetch(`${baseUrl}/logs`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }).catch((err) => {
      devError("%c[Almadel Logger] ❌ Network Error on POST /logs:", "color: #dc2626; font-weight: bold", err);
      return null;
    });

    if (res && res.ok) {
      const data = await res.json().catch(() => ({}));
      devLog("%c[Almadel Logger] ✅ Log successfully persisted to database:", "color: #16a34a; font-weight: bold", data);
    } else {
      if (res) handleApiUnauthorizedStatus(res.status);
      const errorText = res ? await res.text() : "No response";
      devWarn(
        `%c[Almadel Logger] ⚠️ POST /logs returned status ${res?.status || "ERR"}: %c${errorText}`,
        "color: #d97706; font-weight: bold",
        "color: #78350f",
      );

      devLog(`%c[Almadel Logger] 🔄 Retrying with fallback: POST ${baseUrl}/admin/logs`, "color: #6366f1; font-weight: bold");
      const adminRes = await fetch(`${baseUrl}/admin/logs`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }).catch(() => null);

      if (adminRes && adminRes.ok) {
        const data = await adminRes.json().catch(() => ({}));
        devLog("%c[Almadel Logger] ✅ Log successfully persisted via /admin/logs:", "color: #16a34a; font-weight: bold", data);
      } else {
        const adminError = adminRes ? await adminRes.text() : "No response";
        devWarn(
          `%c[Almadel Logger] ⚠️ Fallback POST /admin/logs returned status ${adminRes?.status || "ERR"}: %c${adminError}`,
          "color: #dc2626; font-weight: bold",
          "color: #991b1b",
        );
      }
    }

    window.dispatchEvent(new CustomEvent("almadel_log_added"));
  } catch (err) {
    devError("%c[Almadel Logger] ❌ Unexpected error saving activity log:", "color: #dc2626; font-weight: bold", err);
  }
}

/**
 * Clears all activity logs directly in the PostgreSQL database.
 */
export async function clearAllLogs(): Promise<void> {
  if (typeof window === "undefined") return;
  const token = getAuthItem(tokenKey);
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");

  devLog("%c[Almadel Logger] 🗑️ Requesting DELETE /admin/logs from database...", "color: #e11d48; font-weight: bold");

  if (baseUrl && token) {
    const activeBusinessId = getAuthItem(businessKey);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (activeBusinessId) headers["x-business-id"] = activeBusinessId;

    try {
      let res = await fetch(`${baseUrl}/admin/logs`, {
        method: "DELETE",
        headers,
      }).catch(() => null);

      if (!res || !res.ok) {
        await fetch(`${baseUrl}/logs`, {
          method: "DELETE",
          headers,
        }).catch(() => null);
      }
      devLog("%c[Almadel Logger] 🗑️ Logs delete request completed.", "color: #16a34a; font-weight: bold");
    } catch (err) {
      devError("%c[Almadel Logger] ❌ Failed to delete activity logs from database:", "color: #dc2626; font-weight: bold", err);
    }
  }

  window.dispatchEvent(new CustomEvent("almadel_logs_cleared"));
}
