export type ActivityAction =
  | "PRODUCT_CREATE"
  | "PRODUCT_UPDATE"
  | "PRODUCT_DELETE"
  | "BULK_PRODUCT_DELETE"
  | "STOCK_UPDATE"
  | "CATEGORY_CREATE"
  | "CATEGORY_UPDATE"
  | "CATEGORY_DELETE"
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
    role: "admin" | "staff" | "system";
  };
  details: string;
  target?: string;
  meta?: Record<string, unknown>;
};

let lastVisitTarget = "";
let lastVisitTime = 0;

function getCurrentUser(): { id?: number | null; name: string; email: string; role: "admin" | "staff" } {
  if (typeof window === "undefined") {
    return { name: "System", email: "system@almadel.com", role: "staff" };
  }
  try {
    const raw = localStorage.getItem("almadel_auth_user");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        id: parsed.id ? Number(parsed.id) : null,
        name: parsed.fullName || parsed.name || "Administrator",
        email: parsed.email || "admin@almadel.com",
        role: parsed.role === "admin" ? "admin" : "staff",
      };
    }
  } catch { }
  return { name: "Store Admin", email: "admin@almadel.com", role: "admin" };
}

/**
 * Persists an activity log directly to the PostgreSQL Backend Database.
 */
export async function logActivity(
  action: ActivityAction,
  category: ActivityCategory,
  details: string,
  target?: string,
  meta?: Record<string, unknown>,
  overrideUser?: { id?: number | null; name?: string; email?: string; role?: string }
): Promise<void> {
  if (typeof window === "undefined") return;

  // Throttle rapid duplicate page visit events within 3 seconds
  if (action === "PAGE_VISIT") {
    const now = Date.now();
    if (lastVisitTarget === target && now - lastVisitTime < 3000) {
      return;
    }
    lastVisitTarget = target || "";
    lastVisitTime = now;
  }

  const token = localStorage.getItem("almadel_access_token");
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");

  if (!baseUrl) {
    console.warn("%c[Almadel Logger]%c NEXT_PUBLIC_BACKEND_URL is not set in .env!", "color: #e11d48; font-weight: bold", "color: inherit");
    return;
  }

  const user = {
    ...getCurrentUser(),
    ...overrideUser,
  };

  const payload = {
    action,
    category,
    details,
    target: target || null,
    meta: meta || {},
    userName: user.name,
    userEmail: user.email,
    userRole: user.role,
    userId: user.id || null,
  };

  const activeBusinessId = localStorage.getItem("almadel_active_business_id");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (activeBusinessId) {
    headers["x-business-id"] = activeBusinessId;
  }

  console.log(
    `%c[Almadel Logger] 📤 Sending Log Event -> %c${action} (${category})`,
    "color: #0284c7; font-weight: bold",
    "color: #0f172a; font-weight: 600",
    { url: `${baseUrl}/logs`, payload, hasToken: !!token }
  );

  try {
    // 1. Try POST /logs
    let res = await fetch(`${baseUrl}/logs`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.error("%c[Almadel Logger] ❌ Network Error on POST /logs:", "color: #dc2626; font-weight: bold", err);
      return null;
    });

    if (res && res.ok) {
      const data = await res.json().catch(() => ({}));
      console.log("%c[Almadel Logger] ✅ Log successfully persisted to database:", "color: #16a34a; font-weight: bold", data);
    } else {
      const errorText = res ? await res.text() : "No response";
      console.warn(
        `%c[Almadel Logger] ⚠️ POST /logs returned status ${res?.status || 'ERR'}: %c${errorText}`,
        "color: #d97706; font-weight: bold",
        "color: #78350f"
      );

      // 2. Try fallback to POST /admin/logs
      console.log(`%c[Almadel Logger] 🔄 Retrying with fallback: POST ${baseUrl}/admin/logs`, "color: #6366f1; font-weight: bold");
      const adminRes = await fetch(`${baseUrl}/admin/logs`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }).catch(() => null);

      if (adminRes && adminRes.ok) {
        const data = await adminRes.json().catch(() => ({}));
        console.log("%c[Almadel Logger] ✅ Log successfully persisted via /admin/logs:", "color: #16a34a; font-weight: bold", data);
      } else {
        const adminError = adminRes ? await adminRes.text() : "No response";
        console.warn(
          `%c[Almadel Logger] ⚠️ Fallback POST /admin/logs returned status ${adminRes?.status || 'ERR'}: %c${adminError}`,
          "color: #dc2626; font-weight: bold",
          "color: #991b1b"
        );
      }
    }

    // Trigger UI refresh event in active windows
    window.dispatchEvent(new CustomEvent("almadel_log_added"));
  } catch (err) {
    console.error("%c[Almadel Logger] ❌ Unexpected error saving activity log:", "color: #dc2626; font-weight: bold", err);
  }
}

/**
 * Clears all activity logs directly in the PostgreSQL database.
 */
export async function clearAllLogs(): Promise<void> {
  if (typeof window === "undefined") return;
  const token = localStorage.getItem("almadel_access_token");
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");

  console.log("%c[Almadel Logger] 🗑️ Requesting DELETE /admin/logs from database...", "color: #e11d48; font-weight: bold");

  if (baseUrl) {
    const activeBusinessId = localStorage.getItem("almadel_active_business_id");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
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
      console.log("%c[Almadel Logger] 🗑️ Logs delete request completed.", "color: #16a34a; font-weight: bold");
    } catch (err) {
      console.error("%c[Almadel Logger] ❌ Failed to delete activity logs from database:", "color: #dc2626; font-weight: bold", err);
    }
  }

  window.dispatchEvent(new CustomEvent("almadel_logs_cleared"));
}
