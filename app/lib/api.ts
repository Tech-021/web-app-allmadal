import { businessKey, getAuthItem, handleApiUnauthorizedStatus, tokenKey } from "@/app/lib/auth-session";

const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? "";

function parseApiError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const msg = record.message || record.error || record.detail;
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  if (typeof payload === "string" && payload.length > 0) return payload;
  return `Request failed with status ${status}.`;
}

/** Unauthenticated JSON requests (sign-in, forgot-password, reset-password, etc.). */
export async function publicApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!baseUrl) throw new Error("Backend URL is not configured.");
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseApiError(payload, response.status));
  }
  return payload as T;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthItem(tokenKey);
  if (!baseUrl || !token) throw new Error("Your session is not available. Please sign in again.");
  const activeBusinessId = getAuthItem(businessKey);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  if (activeBusinessId) {
    headers["x-business-id"] = activeBusinessId;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    cache: "no-store",
    headers: { ...headers, ...options.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    handleApiUnauthorizedStatus(response.status);
    throw new Error(parseApiError(payload, response.status));
  }
  return payload as T;
}

export async function uploadProductImage(file: File): Promise<{ url: string }> {
  const token = getAuthItem(tokenKey);
  const businessId = getAuthItem(businessKey);
  if (!baseUrl || !token) throw new Error("Your session is not available. Please sign in again.");
  const form = new FormData(); form.append("image", file);
  const response = await fetch(`${baseUrl}/products/images`, { method: "POST", body: form, headers: { Authorization: `Bearer ${token}`, ...(businessId ? { "x-business-id": businessId } : {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    handleApiUnauthorizedStatus(response.status);
    throw new Error(parseApiError(payload, response.status) || "Could not upload image.");
  }
  return payload as { url: string };
}

export function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") || "http://localhost:4000";
  return `${backendBase}${url.startsWith("/") ? "" : "/"}${url}`;
}

export type Product = { id:number; barcode:string; category?:string|null; costPrice:number; imageUrl?:string|null; lowStockThreshold:number; name:string; price:number; qrCode?:string|null; sellingPrice:number; sku?:string|null; stock:number; discountType?: "none" | "fixed" | "percentage"; discountValue?: number };
export type StaffItem = { user:{ id:number; email:string; fullName:string|null; role:"staff" | "accountant" | "admin" }; stats:{ products:number; sales:number; stockLogs:number; totalItemsSold:number; totalSales:number } };

/** Backend list: raw array (`?legacy=1`) or `{ products, pagination }`. */
export function parseProductList(payload: unknown): Product[] {
  if (Array.isArray(payload)) return payload as Product[];
  if (payload && typeof payload === "object") {
    const list = (payload as { products?: unknown }).products;
    if (Array.isArray(list)) return list as Product[];
  }
  return [];
}

const PRODUCT_CATALOG_LIMIT = 250;

/** Catalog / POS — up to server max for client-side search and filters. */
export async function fetchProductCatalog(): Promise<Product[]> {
  const payload = await api<unknown>(`/products?limit=${PRODUCT_CATALOG_LIMIT}`);
  return parseProductList(payload);
}
