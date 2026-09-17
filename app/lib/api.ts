const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? "";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("almadel_access_token") : null;
  if (!baseUrl || !token) throw new Error("Your session is not available. Please sign in again.");
  const activeBusinessId = typeof window !== "undefined" ? localStorage.getItem("almadel_active_business_id") : null;
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
    const errorMsg =
      payload.message ||
      payload.error ||
      payload.detail ||
      (typeof payload === "string" ? payload : "") ||
      `Request failed with status ${response.status}.`;
    throw new Error(errorMsg);
  }
  return payload as T;
}

export async function uploadProductImage(file: File): Promise<{ url: string }> {
  const token = typeof window !== "undefined" ? localStorage.getItem("almadel_access_token") : null;
  const businessId = typeof window !== "undefined" ? localStorage.getItem("almadel_active_business_id") : null;
  if (!baseUrl || !token) throw new Error("Your session is not available. Please sign in again.");
  const form = new FormData(); form.append("image", file);
  const response = await fetch(`${baseUrl}/products/images`, { method: "POST", body: form, headers: { Authorization: `Bearer ${token}`, ...(businessId ? { "x-business-id": businessId } : {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "Could not upload image.");
  return payload as { url: string };
}

export type Product = { id:number; barcode:string; category?:string|null; costPrice:number; imageUrl?:string|null; lowStockThreshold:number; name:string; price:number; qrCode?:string|null; sellingPrice:number; sku?:string|null; stock:number };
export type StaffItem = { user:{ id:number; email:string; fullName:string|null; role:"staff" }; stats:{ products:number; sales:number; stockLogs:number; totalItemsSold:number; totalSales:number } };
